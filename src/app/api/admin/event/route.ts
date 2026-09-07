import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { isTicketWindowOpen } from "@/lib/utils";

export async function GET() {
  try {
    // Public endpoint — event info shown on landing page and student dashboard
    const supabase = await createServiceClient();

    const { data: events } = await supabase
      .from("events")
      .select("*")
      .limit(1);

    const event = events?.[0] || null;
    const ticketAvailable = event
      ? isTicketWindowOpen(
          event.ticket_live,
          event.ticket_open_at,
          event.ticket_close_at
        )
      : false;

    return NextResponse.json({ event, ticketAvailable });
  } catch (error) {
    console.error("Event fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch event." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (!guard.authorized) return guard.error;
    const body = await request.json();
    const supabase = await createServiceClient();

    // Get existing event
    const { data: events } = await supabase
      .from("events")
      .select("id")
      .limit(1);

    const updateData = {
      name: body.name,
      description: body.description || null,
      date: body.date || null,
      start_time: body.start_time || null,
      end_time: body.end_time || null,
      venue: body.venue || null,
      attire: body.attire || null,
      instructions: body.instructions || null,
      banner_url: body.banner_url || null,
    };

    if (events && events.length > 0) {
      const { error } = await supabase
        .from("events")
        .update(updateData)
        .eq("id", events[0].id);

      if (error) throw error;
    } else {
      const { error } = await supabase.from("events").insert(updateData);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Event update error:", error);
    return NextResponse.json(
      { error: "Failed to update event." },
      { status: 500 }
    );
  }
}
