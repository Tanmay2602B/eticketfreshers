import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
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
      // Generic error — do not reveal whether email exists
      return NextResponse.json(
        {
          error:
            "This email is not registered in our eligible student list. Please contact your college administration if you believe this is an error.",
        },
        { status: 403 }
      );
    }

    // Send OTP via Supabase Auth
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (otpError) {
      console.error("OTP send error:", otpError);
      // Handle rate limiting
      if (otpError.message?.includes("rate") || otpError.status === 429) {
        return NextResponse.json(
          {
            error:
              "Too many requests. Please wait a few minutes before trying again.",
          },
          { status: 429 }
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
