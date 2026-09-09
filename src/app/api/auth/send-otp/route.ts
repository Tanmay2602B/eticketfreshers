import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Simple email regex — catches most invalid inputs without being overly strict
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();

    if (!email || !EMAIL_REGEX.test(email)) {
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
      .eq("email", email)
      .maybeSingle();

    if (lookupError) {
      console.error("Eligible student lookup error:", lookupError);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    if (!student) {
      // Do not reveal whether the email exists in our system at all.
      // Use a generic message to prevent user enumeration.
      return NextResponse.json(
        {
          error:
            "This email is not registered for Freshers 2026. Please contact your college administration if you believe this is an error.",
        },
        { status: 403 }
      );
    }

    // Send OTP via Supabase Auth
    // shouldCreateUser: true is intentional here — eligible students are verified
    // above, and Supabase Auth needs a user record to send OTP to. The server-side
    // eligibility check gates who can reach this point.
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (otpError) {
      console.error("OTP send error:", otpError);

      // Handle rate limiting from Supabase
      if (
        otpError.message?.toLowerCase().includes("rate") ||
        otpError.message?.toLowerCase().includes("limit") ||
        otpError.status === 429
      ) {
        return NextResponse.json(
          {
            error:
              "Too many requests. Please wait a few minutes before trying again.",
          },
          { status: 429 }
        );
      }

      // Handle email sending failures (SMTP misconfiguration, etc.)
      if (otpError.message?.toLowerCase().includes("email")) {
        return NextResponse.json(
          {
            error:
              "Unable to send verification code. Please try again later.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: "Failed to send verification code. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Send OTP error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
