import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/late-ticket/resend-otp
 * Body: { email: string }
 *
 * Public route. Allows student to request a new OTP if the previous one expired.
 */
export async function POST(request: NextRequest) {
  let body: { email?: string };
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

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Verify a non-cancelled late ticket exists for this email
    const { data: lateTicket } = await supabase
      .from("late_tickets")
      .select("id, status, cancelled_at")
      .eq("email", email)
      .is("cancelled_at", null)
      .maybeSingle();

    if (!lateTicket) {
      return NextResponse.json(
        { error: "No late-comer ticket found for this email." },
        { status: 404 }
      );
    }

    if (lateTicket.status === "verified") {
      return NextResponse.json(
        { error: "Your ticket has already been verified. Please access it directly." },
        { status: 400 }
      );
    }

    // Resend OTP
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    if (otpError) {
      console.error("Late ticket resend OTP error:", otpError);
      if (
        otpError.message?.toLowerCase().includes("rate") ||
        otpError.message?.toLowerCase().includes("limit") ||
        otpError.status === 429
      ) {
        return NextResponse.json(
          { error: "Too many requests. Please wait a few minutes before requesting again." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Failed to resend verification code. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
