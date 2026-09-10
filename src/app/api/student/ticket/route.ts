import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateTicketId, generateSecureToken, isTicketWindowOpen } from "@/lib/utils";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = await createServiceClient();
    const email = user.email.toLowerCase();

    // Verify student is registered
    const { data: student } = await serviceClient
      .from("eligible_students")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!student) {
      return NextResponse.json(
        { error: "This email is not registered for Freshers 2026." },
        { status: 403 }
      );
    }

    // Fetch the ticket strictly for this authenticated user and student
    const { data: ticket, error } = await serviceClient
      .from("tickets")
      .select("*")
      .eq("eligible_student_id", student.id)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Ticket fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch ticket." },
        { status: 500 }
      );
    }

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("Get ticket error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = await createServiceClient();
    const email = user.email.toLowerCase();

    // Get student
    const { data: student } = await serviceClient
      .from("eligible_students")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (!student) {
      return NextResponse.json(
        { error: "Not eligible for ticket." },
        { status: 403 }
      );
    }

    // Get event
    const { data: events } = await serviceClient
      .from("events")
      .select("*")
      .limit(1);

    const event = events?.[0];
    if (!event) {
      return NextResponse.json(
        { error: "No event configured." },
        { status: 404 }
      );
    }

    // Check ticket window
    if (
      !isTicketWindowOpen(
        event.ticket_live,
        event.ticket_open_at,
        event.ticket_close_at
      )
    ) {
      return NextResponse.json(
        { error: "Ticket system is currently closed." },
        { status: 403 }
      );
    }

    // Check for existing ticket
    const { data: existingTicket } = await serviceClient
      .from("tickets")
      .select("*")
      .eq("eligible_student_id", student.id)
      .eq("event_id", event.id)
      .maybeSingle();

    if (existingTicket) {
      return NextResponse.json({ ticket: existingTicket });
    }

    // Generate new ticket
    const ticketId = generateTicketId();
    const qrToken = generateSecureToken();

    const { data: newTicket, error: insertError } = await serviceClient
      .from("tickets")
      .insert({
        ticket_id: ticketId,
        event_id: event.id,
        eligible_student_id: student.id,
        auth_user_id: user.id,
        qr_token: qrToken,
        status: "ACTIVE",
      })
      .select()
      .single();

    if (insertError) {
      // Handle unique constraint violation (duplicate)
      if (insertError.code === "23505") {
        const { data: existing } = await serviceClient
          .from("tickets")
          .select("*")
          .eq("eligible_student_id", student.id)
          .eq("event_id", event.id)
          .single();

        return NextResponse.json({ ticket: existing });
      }

      console.error("Ticket creation error:", insertError);
      return NextResponse.json(
        { error: "Failed to generate ticket." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ticket: newTicket });
  } catch (error) {
    console.error("Ticket generation error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const ticketId = body.ticket_id;

    if (!ticketId) {
      return NextResponse.json(
        { error: "Ticket ID required." },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();

    // Mark downloaded
    await serviceClient
      .from("tickets")
      .update({ downloaded_at: new Date().toISOString() })
      .eq("id", ticketId)
      .eq("auth_user_id", user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Ticket download mark error:", error);
    return NextResponse.json(
      { error: "Failed to update." },
      { status: 500 }
    );
  }
}
