import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";

/**
 * POST /api/admin/resend-otp
 * Body: { student_id: string }  ← eligible_students UUID
 *
 * Admin-only. Looks up the student's email, ensures a Supabase Auth user
 * exists for that email, then fires a fresh OTP magic-link email so the
 * student can log in and access their ticket.
 *
 * Use this when a ticket was created but the original OTP email failed
 * to deliver, or the student never received / lost the email.
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (!guard.authorized) return guard.error;

    const body = await request.json();
    const studentId = (body.student_id || "").trim();

    if (!studentId) {
      return NextResponse.json(
        { error: "student_id is required." },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // ── 1. Look up the student ──────────────────────────────────────
    const { data: student, error: studentError } = await supabase
      .from("eligible_students")
      .select("id, name, email")
      .eq("id", studentId)
      .maybeSingle();

    if (studentError) throw studentError;

    if (!student) {
      return NextResponse.json(
        { error: "Student not found." },
        { status: 404 }
      );
    }

    const email = student.email.trim().toLowerCase();

    // ── 2. Ensure a Supabase Auth user exists for this email ────────
    // createUser is idempotent-ish: if the user already exists it returns
    // an error which we intentionally swallow. This guarantees that
    // shouldCreateUser: false on signInWithOtp will succeed.
    await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });

    // ── 3. Send OTP ─────────────────────────────────────────────────
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    if (otpError) {
      console.error("Admin resend OTP error:", otpError);

      // Surface rate-limit errors explicitly
      if (
        otpError.message?.toLowerCase().includes("rate") ||
        otpError.message?.toLowerCase().includes("limit") ||
        otpError.status === 429
      ) {
        return NextResponse.json(
          {
            error:
              "Too many OTP requests for this email. Please wait a few minutes before retrying.",
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `Failed to send OTP: ${otpError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `OTP email sent successfully to ${email}`,
    });
  } catch (error) {
    console.error("Admin resend OTP error:", error);
    return NextResponse.json(
      { error: "Failed to resend OTP. Please try again." },
      { status: 500 }
    );
  }
}
