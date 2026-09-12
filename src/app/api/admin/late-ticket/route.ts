import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { generateTicketId, generateSecureToken } from "@/lib/utils";
import type { CreateLateTicketPayload } from "@/lib/types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GET /api/admin/late-ticket
 * Returns all late-comer tickets ordered by newest first.
 */
export async function GET() {
  try {
    const guard = await requireAdmin();
    if (!guard.authorized) return guard.error;

    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("late_tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ tickets: data ?? [] });
  } catch (error) {
    console.error("Late ticket list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch late tickets." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/late-ticket
 * Body: { name, email, student_id?, reason? }
 *
 * Admin-only. Creates a late-comer ticket record and sends OTP via Supabase Auth.
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (!guard.authorized) return guard.error;

    let body: CreateLateTicketPayload;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const name = (body.name || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const studentId = (body.student_id || "").trim() || null;
    const reason = (body.reason || "").trim() || null;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Student name is required." },
        { status: 400 }
      );
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Check if a non-cancelled late ticket already exists for this email
    const { data: existing } = await supabase
      .from("late_tickets")
      .select("id, status, ticket_id")
      .eq("email", email)
      .is("cancelled_at", null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error: `A late-comer ticket already exists for ${email}. Cancel it first if you need to re-create.`,
        },
        { status: 409 }
      );
    }

    // Generate ticket identifiers upfront
    const ticketId = generateTicketId();
    const qrToken = generateSecureToken();

    // Insert late ticket record
    const { data: newTicket, error: insertError } = await supabase
      .from("late_tickets")
      .insert({
        name,
        email,
        student_id: studentId,
        reason,
        status: "pending",
        ticket_id: ticketId,
        qr_token: qrToken,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Send OTP via Supabase Auth.
    // shouldCreateUser: true — Supabase will create the auth user if they don't
    // already exist, so late-comer students (not in eligible_students) can still
    // receive an OTP without a separate admin.createUser() call.
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    if (otpError) {
      console.error("Late ticket OTP send error:", otpError);

      // Roll back the insert if OTP fails
      await supabase.from("late_tickets").delete().eq("id", newTicket.id);

      if (
        otpError.message?.toLowerCase().includes("rate") ||
        otpError.message?.toLowerCase().includes("limit") ||
        otpError.status === 429
      ) {
        return NextResponse.json(
          { error: "Too many OTP requests. Please wait before trying again." },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: "Ticket created but OTP email failed to send. Please resend manually." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, ticket: newTicket });
  } catch (error) {
    console.error("Late ticket create error:", error);
    return NextResponse.json(
      { error: "Failed to create late-comer ticket." },
      { status: 500 }
    );
  }
}
