import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";

export async function DELETE(request: Request) {
  try {
    const guard = await requireAdmin();
    if (!guard.authorized) return guard.error;

    const body = await request.json();
    const ids: string[] = body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No student IDs provided." }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Safety check: do not delete students who have ACTIVE or USED tickets
    const { data: blockedTickets } = await supabase
      .from("tickets")
      .select("eligible_student_id, status")
      .in("eligible_student_id", ids)
      .in("status", ["ACTIVE", "USED"]);

    const blockedIds = new Set((blockedTickets || []).map((t) => t.eligible_student_id));
    const safeIds = ids.filter((id) => !blockedIds.has(id));

    if (safeIds.length === 0) {
      return NextResponse.json(
        { error: "Cannot delete: selected students have active or used tickets." },
        { status: 422 }
      );
    }

    const { error } = await supabase
      .from("eligible_students")
      .delete()
      .in("id", safeIds);

    if (error) throw error;

    return NextResponse.json({
      deleted: safeIds.length,
      skipped: ids.length - safeIds.length,
    });
  } catch (error) {
    console.error("Student delete error:", error);
    return NextResponse.json({ error: "Failed to delete students." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const guard = await requireAdmin();
    if (!guard.authorized) return guard.error;

    const supabase = await createServiceClient();

    // Fetch all eligible students
    const { data: students, error: studentsError } = await supabase
      .from("eligible_students")
      .select("id, name, email, student_id, course, mobile, imported_at")
      .order("name", { ascending: true });

    if (studentsError) throw studentsError;

    if (!students || students.length === 0) {
      return NextResponse.json({ students: [] });
    }

    // Fetch all tickets (to know who has a ticket and its status)
    const { data: tickets } = await supabase
      .from("tickets")
      .select("eligible_student_id, ticket_id, status, generated_at, downloaded_at, used_at");

    // Fetch all successful check-ins (VALID scans only)
    const { data: checkins } = await supabase
      .from("checkins")
      .select("ticket_id, scanned_at, result")
      .eq("result", "VALID");

    // Build ticket map keyed by eligible_student_id
    const ticketMap = new Map(
      (tickets || []).map((t) => [t.eligible_student_id, t])
    );

    // Build checkin set keyed by ticket_id (UUID from tickets table)
    // We need ticket UUID → checkin, so first build ticket UUID map
    const { data: ticketsWithId } = await supabase
      .from("tickets")
      .select("id, eligible_student_id");

    const ticketUuidMap = new Map(
      (ticketsWithId || []).map((t) => [t.eligible_student_id, t.id])
    );

    const checkinSet = new Set((checkins || []).map((c) => c.ticket_id));

    // Merge into student rows
    const enriched = students.map((student) => {
      const ticket = ticketMap.get(student.id) ?? null;
      const ticketUuid = ticketUuidMap.get(student.id) ?? null;
      const scanned = ticketUuid ? checkinSet.has(ticketUuid) : false;

      return {
        ...student,
        ticket_status: ticket ? ticket.status : null,        // ACTIVE | USED | CANCELLED | null
        ticket_id: ticket ? ticket.ticket_id : null,         // human-readable TKT-XXXXXX
        ticket_generated: ticket ? ticket.generated_at : null,
        ticket_downloaded: ticket ? ticket.downloaded_at : null,
        ticket_used_at: ticket ? ticket.used_at : null,
        scanned,                                              // true = entry verified at gate
      };
    });

    return NextResponse.json({ students: enriched });
  } catch (error) {
    console.error("Students list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch students." },
      { status: 500 }
    );
  }
}
