import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";

export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (!guard.authorized) return guard.error;
    const body = await request.json();
    const qrToken = (body.qr_token || "").trim();

    if (!qrToken) {
      return NextResponse.json(
        {
          result: "INVALID" as const,
          message: "No QR data provided.",
        },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Look up ticket by QR token
    const { data: ticket, error: lookupError } = await supabase
      .from("tickets")
      .select(
        `
        *,
        eligible_students!inner (
          name,
          student_id,
          course
        )
      `
      )
      .eq("qr_token", qrToken)
      .maybeSingle();

    if (lookupError) {
      console.error("Scan lookup error:", lookupError);
      return NextResponse.json({
        result: "INVALID" as const,
        message: "Error verifying ticket.",
      });
    }

    if (!ticket) {
      // Log invalid scan attempt
      return NextResponse.json({
        result: "INVALID" as const,
        message: "This QR code is not associated with any valid ticket.",
      });
    }

    const studentData = ticket.eligible_students as unknown as {
      name: string;
      student_id: string;
      course: string | null;
    };

    // Check ticket status
    if (ticket.status === "CANCELLED") {
      // Log cancelled scan
      await supabase.from("checkins").insert({
        ticket_id: ticket.id,
        result: "CANCELLED",
      });

      return NextResponse.json({
        result: "CANCELLED" as const,
        ticket_id: ticket.ticket_id,
        student: studentData,
        message: "This ticket has been cancelled.",
      });
    }

    if (ticket.status === "USED") {
      // Log duplicate scan attempt
      await supabase.from("checkins").insert({
        ticket_id: ticket.id,
        result: "ALREADY_USED",
      });

      return NextResponse.json({
        result: "ALREADY_USED" as const,
        ticket_id: ticket.ticket_id,
        student: studentData,
        used_at: ticket.used_at,
        message: `This ticket was already used on ${ticket.used_at ? new Date(ticket.used_at).toLocaleString("en-IN") : "N/A"}.`,
      });
    }

    // ACTIVE ticket — mark as USED (atomic update with WHERE clause to prevent races)
    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("tickets")
      .update({ status: "USED", used_at: now })
      .eq("id", ticket.id)
      .eq("status", "ACTIVE") // Optimistic lock: only update if still ACTIVE
      .select()
      .maybeSingle();

    if (updateError || !updated) {
      // Race condition: another scan got there first
      return NextResponse.json({
        result: "ALREADY_USED" as const,
        ticket_id: ticket.ticket_id,
        student: studentData,
        message: "This ticket was just used by another scan.",
      });
    }

    // Log successful check-in
    await supabase.from("checkins").insert({
      ticket_id: ticket.id,
      result: "VALID",
    });

    return NextResponse.json({
      result: "VALID" as const,
      ticket_id: ticket.ticket_id,
      student: studentData,
      message: "Entry allowed. Welcome!",
    });
  } catch (error) {
    console.error("Scan error:", error);
    return NextResponse.json(
      {
        result: "INVALID" as const,
        message: "Error processing scan. Please try again.",
      },
      { status: 500 }
    );
  }
}
