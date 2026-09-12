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
      // ── Fallback: check late-comer tickets ──────────────────────────
      const { data: lateTicket, error: lateLookupError } = await supabase
        .from("late_tickets")
        .select("*")
        .eq("qr_token", qrToken)
        .is("cancelled_at", null)
        .maybeSingle();

      if (lateLookupError) {
        console.error("Late ticket scan lookup error:", lateLookupError);
      }

      if (!lateTicket) {
        return NextResponse.json({
          result: "INVALID" as const,
          message: "This QR code is not associated with any valid ticket.",
        });
      }

      // Late ticket found — check status
      if (lateTicket.status !== "verified") {
        return NextResponse.json({
          result: "INVALID" as const,
          message: "This late-comer ticket has not been verified by the student yet.",
        });
      }

      // Mark as accessed (used) — update accessed_at as the usage marker
      // We reuse the existing accessed_at field; a second scan = "already used"
      if (lateTicket.accessed_at) {
        // Check if it was already used as entry (accessed more than 2 min ago = used)
        const accessedMs = new Date(lateTicket.accessed_at).getTime();
        const nowMs = Date.now();
        if (nowMs - accessedMs > 2 * 60 * 1000) {
          return NextResponse.json({
            result: "ALREADY_USED" as const,
            ticket_id: lateTicket.ticket_id,
            student: {
              name: lateTicket.name,
              student_id: lateTicket.student_id || "N/A",
              course: null,
            },
            used_at: lateTicket.accessed_at,
            message: `This ticket was already used on ${new Date(lateTicket.accessed_at).toLocaleString("en-IN")}.`,
          });
        }
      }

      // Mark entry time
      await supabase
        .from("late_tickets")
        .update({ accessed_at: new Date().toISOString() })
        .eq("id", lateTicket.id);

      return NextResponse.json({
        result: "VALID" as const,
        ticket_id: lateTicket.ticket_id,
        student: {
          name: lateTicket.name,
          student_id: lateTicket.student_id || "Late Entry",
          course: lateTicket.reason ? `Reason: ${lateTicket.reason}` : null,
        },
        message: "Late comer entry allowed. Welcome!",
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
