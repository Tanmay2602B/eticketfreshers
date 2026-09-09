import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();
    const token = (body.token || "").trim();

    if (!email || !token) {
      return NextResponse.json(
        { error: "Email and verification code are required." },
        { status: 400 }
      );
    }

    // OTP must be exactly 6 digits
    if (!/^\d{6}$/.test(token)) {
      return NextResponse.json(
        { error: "Please enter a valid 6-digit code." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) {
      console.error("OTP verification error:", error);

      // Handle specific error cases with user-friendly messages
      if (
        error.message?.toLowerCase().includes("expired") ||
        error.message?.toLowerCase().includes("otp_expired")
      ) {
        return NextResponse.json(
          { error: "Verification code has expired. Please request a new one." },
          { status: 400 }
        );
      }

      if (
        error.message?.toLowerCase().includes("rate") ||
        error.status === 429
      ) {
        return NextResponse.json(
          { error: "Too many attempts. Please wait before trying again." },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: "Invalid or expired verification code. Please try again." },
        { status: 400 }
      );
    }

    if (!data.session) {
      return NextResponse.json(
        { error: "Verification failed. Please try again." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, redirect: "/dashboard" });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
