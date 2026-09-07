import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isTicketWindowOpen } from "@/lib/utils";

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = await createServiceClient();
    const email = user.email.toLowerCase();

    // Get eligible student
    const { data: student } = await serviceClient
      .from("eligible_students")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (!student) {
      return NextResponse.json(
        { error: "Student not found in eligible list." },
        { status: 404 }
      );
    }

    // Get event
    const { data: events } = await serviceClient
      .from("events")
      .select("*")
      .limit(1);

    const event = events?.[0] || null;

    // Check ticket availability
    const ticketAvailable = event
      ? isTicketWindowOpen(
          event.ticket_live,
          event.ticket_open_at,
          event.ticket_close_at
        )
      : false;

    // Get existing ticket
    let ticket = null;
    if (event) {
      const { data: existingTicket } = await serviceClient
        .from("tickets")
        .select("*")
        .eq("eligible_student_id", student.id)
        .eq("event_id", event.id)
        .maybeSingle();

      ticket = existingTicket;
    }

    return NextResponse.json({
      student,
      event,
      ticket,
      ticketAvailable,
    });
  } catch (error) {
    console.error("Student dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard." },
      { status: 500 }
    );
  }
}
