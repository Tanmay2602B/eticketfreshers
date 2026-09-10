import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Simple email regex — validates proper standard email format
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  try {
    const normalizedEmail = (body?.email || "").trim().toLowerCase();

    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Check if email exists in eligible students
    const { data: student, error: lookupError } = await supabase
      .from("eligible_students")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (lookupError) {
      console.error("Eligible student lookup error:", lookupError);
      return NextResponse.json(
        { error: "Unable to send OTP. Please try again." },
        { status: 500 }
      );
    }

    if (!student) {
      return NextResponse.json(
        { error: "This email is not registered for Freshers 2026." },
        { status: 403 }
      );
    }

    // Ensure user exists in Supabase Auth so shouldCreateUser: false succeeds
    // If the user already exists in auth.users, createUser safely returns an error which is ignored.
    await supabase.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
    });

    // Send OTP via Supabase Auth Email OTP
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: false,
      },
    });

    if (otpError) {
      console.error("OTP send error:", otpError);

      // Handle rate limiting from Supabase Auth
      if (
        otpError.message?.toLowerCase().includes("rate") ||
        otpError.message?.toLowerCase().includes("limit") ||
        otpError.status === 429
      ) {
        return NextResponse.json(
          {
            error:
              "Too many requests. Please wait before requesting another OTP.",
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: "Unable to send OTP. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Send OTP error:", error);
    return NextResponse.json(
      { error: "Unable to send OTP. Please try again." },
      { status: 500 }
    );
  }
}
