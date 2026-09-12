import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";

/**
 * DELETE /api/admin/late-ticket/[id]
 * Soft-cancels a late-comer ticket by setting cancelled_at timestamp.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin();
    if (!guard.authorized) return guard.error;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing ticket id." }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("late_tickets")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", id)
      .is("cancelled_at", null) // Only cancel if not already cancelled
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "Ticket not found or already cancelled." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, ticket: data });
  } catch (error) {
    console.error("Late ticket cancel error:", error);
    return NextResponse.json(
      { error: "Failed to cancel ticket." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/late-ticket/[id]/resend
 * Resends the OTP for a late-comer ticket.
 * (Convenience re-send from the admin side)
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin();
    if (!guard.authorized) return guard.error;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing ticket id." }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Fetch the ticket
    const { data: ticket, error: fetchError } = await supabase
      .from("late_tickets")
      .select("id, email, status, cancelled_at")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    }
    if (ticket.cancelled_at) {
      return NextResponse.json(
        { error: "Cannot resend OTP for a cancelled ticket." },
        { status: 400 }
      );
    }

    // Resend OTP
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: ticket.email,
      options: { shouldCreateUser: false },
    });

    if (otpError) {
      console.error("Resend OTP error:", otpError);
      if (
        otpError.message?.toLowerCase().includes("rate") ||
        otpError.status === 429
      ) {
        return NextResponse.json(
          { error: "Too many requests. Please wait before resending." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Failed to resend OTP." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return NextResponse.json(
      { error: "Failed to resend OTP." },
      { status: 500 }
    );
  }
}
