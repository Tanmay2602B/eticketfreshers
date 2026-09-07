import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";

export async function PUT(request: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (!guard.authorized) return guard.error;
    const body = await request.json();
    const supabase = await createServiceClient();

    const { data: events } = await supabase
      .from("events")
      .select("id")
      .limit(1);

    if (!events || events.length === 0) {
      return NextResponse.json(
        { error: "No event found. Create an event first." },
        { status: 404 }
      );
    }

    const updateData = {
      ticket_live: Boolean(body.ticket_live),
      ticket_open_at: body.ticket_open_at || null,
      ticket_close_at: body.ticket_close_at || null,
    };

    const { error } = await supabase
      .from("events")
      .update(updateData)
      .eq("id", events[0].id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Ticket control error:", error);
    return NextResponse.json(
      { error: "Failed to update ticket control." },
      { status: 500 }
    );
  }
}
