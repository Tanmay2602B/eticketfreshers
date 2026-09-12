import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/late-ticket/verify
 * Body: { email: string, token: string }
 *
 * Public route (no auth required). Student submits their email + 6-digit OTP.
 * On success, marks the late ticket as verified and returns the ticket data.
 */
export async function POST(request: NextRequest) {
  let body: { email?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  try {
    const email = (body?.email || "").trim().toLowerCase();
    const token = (body?.token || "").trim();

    if (!email || !token) {
      return NextResponse.json(
        { error: "Email and verification code are required." },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(token)) {
      return NextResponse.json(
        { error: "Please enter a valid 6-digit code." },
        { status: 400 }
      );
    }

    // 1. Look up the late ticket record first — before verifying OTP
    const serviceClient = await createServiceClient();
    const { data: lateTicket, error: ticketError } = await serviceClient
      .from("late_tickets")
      .select("*")
      .eq("email", email)
      .is("cancelled_at", null)
      .maybeSingle();

    if (ticketError) {
      console.error("Late ticket lookup error:", ticketError);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    if (!lateTicket) {
      return NextResponse.json(
        { error: "No late-comer ticket found for this email. Please contact the admin." },
        { status: 404 }
      );
    }

    // 2. Verify OTP via Supabase Auth
    const supabase = await createClient();
    const { data, error: otpError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (otpError) {
      console.error("OTP verify error:", otpError);
      if (
        otpError.message?.toLowerCase().includes("rate") ||
        otpError.status === 429
      ) {
        return NextResponse.json(
          { error: "Too many attempts. Please wait before trying again." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    if (!data.session || !data.user) {
      return NextResponse.json(
        { error: "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    // 3. Mark ticket as verified and record access time
    const { data: updatedTicket, error: updateError } = await serviceClient
      .from("late_tickets")
      .update({
        status: "verified",
        accessed_at: new Date().toISOString(),
      })
      .eq("id", lateTicket.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 4. Fetch event for ticket display
    const { data: events } = await serviceClient
      .from("events")
      .select("*")
      .limit(1);

    const event = events?.[0] ?? null;

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
      event,
    });
  } catch (error) {
    console.error("Late ticket verify error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
