import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { generateTicketId, generateSecureToken } from "@/lib/utils";

/**
 * POST /api/admin/ticket-generate
 * Body: { student_id: string }   ← the eligible_students UUID
 *
 * Admin-only. Generates a ticket for the student if one doesn't exist,
 * or returns the existing one. Returns the full ticket + student + event
 * payload needed to render the PDF client-side.
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

    // ── 1. Verify the student exists ──────────────────────────────
    const { data: student, error: studentError } = await supabase
      .from("eligible_students")
      .select("*")
      .eq("id", studentId)
      .maybeSingle();

    if (studentError) throw studentError;
    if (!student) {
      return NextResponse.json(
        { error: "Student not found." },
        { status: 404 }
      );
    }

    // ── 2. Get event ──────────────────────────────────────────────
    const { data: events } = await supabase
      .from("events")
      .select("*")
      .limit(1);

    const event = events?.[0] ?? null;
    if (!event) {
      return NextResponse.json(
        { error: "No event configured. Create an event first." },
        { status: 404 }
      );
    }

    // ── 3. Check if ticket already exists ────────────────────────
    const { data: existingTicket } = await supabase
      .from("tickets")
      .select("*")
      .eq("eligible_student_id", student.id)
      .eq("event_id", event.id)
      .maybeSingle();

    if (existingTicket) {
      // Return existing — admin download should always work regardless of
      // ticket_live window, so we skip the window check here.
      return NextResponse.json({ ticket: existingTicket, student, event });
    }

    // ── 4. Ticket window check — admin can override ───────────────
    // We intentionally skip isTicketWindowOpen here so admin can always
    // generate a ticket on behalf of a student even if the window is closed.

    // ── 5. Generate new ticket ────────────────────────────────────
    const ticketId  = generateTicketId();
    const qrToken   = generateSecureToken();

    const { data: newTicket, error: insertError } = await supabase
      .from("tickets")
      .insert({
        ticket_id:            ticketId,
        event_id:             event.id,
        eligible_student_id:  student.id,
        // Admin-generated tickets use a sentinel UUID for auth_user_id
        // since there is no student Supabase Auth session to reference.
        auth_user_id:         "00000000-0000-0000-0000-000000000000",
        qr_token:             qrToken,
        status:               "ACTIVE",
      })
      .select()
      .single();

    if (insertError) {
      // Handle race — another request may have inserted simultaneously
      if (insertError.code === "23505") {
        const { data: racedTicket } = await supabase
          .from("tickets")
          .select("*")
          .eq("eligible_student_id", student.id)
          .eq("event_id", event.id)
          .single();

        return NextResponse.json({ ticket: racedTicket, student, event });
      }
      throw insertError;
    }

    return NextResponse.json({ ticket: newTicket, student, event });
  } catch (error) {
    console.error("Admin ticket generate error:", error);
    return NextResponse.json(
      { error: "Failed to generate ticket." },
      { status: 500 }
    );
  }
}
