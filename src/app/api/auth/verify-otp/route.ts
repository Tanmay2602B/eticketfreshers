import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  let body: { email?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Please enter a valid email address and verification code." },
      { status: 400 }
    );
  }

  try {
    const normalizedEmail = (body?.email || "").trim().toLowerCase();
    const token = (body?.token || "").trim();

    if (!normalizedEmail || !token) {
      return NextResponse.json(
        { error: "Please enter a valid email address and verification code." },
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
      email: normalizedEmail,
      token,
      type: "email",
    });

    if (error) {
      console.error("OTP verification error:", error);

      if (
        error.message?.toLowerCase().includes("rate") ||
        error.status === 429
      ) {
        return NextResponse.json(
          { error: "Too many requests. Please wait before requesting another OTP." },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: "Invalid or expired OTP." },
        { status: 400 }
      );
    }

    if (!data.session || !data.user) {
      return NextResponse.json(
        { error: "Invalid or expired OTP." },
        { status: 400 }
      );
    }

    // Student Authorization: Verify the authenticated email is in eligible_students
    const verifiedEmail = (data.user.email || "").toLowerCase();
    const serviceClient = await createServiceClient();

    const { data: student, error: studentError } = await serviceClient
      .from("eligible_students")
      .select("id")
      .eq("email", verifiedEmail)
      .maybeSingle();

    if (studentError || !student) {
      // Invalidate session if not authorized
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "This email is not registered for Freshers 2026." },
        { status: 403 }
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
