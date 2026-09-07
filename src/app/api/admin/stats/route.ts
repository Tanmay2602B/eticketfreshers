import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";

export async function GET() {
  try {
    const guard = await requireAdmin();
    if (!guard.authorized) return guard.error;
    const supabase = await createServiceClient();

    // Count eligible students
    const { count: eligible } = await supabase
      .from("eligible_students")
      .select("*", { count: "exact", head: true });

    // Count generated tickets
    const { count: generated } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true });

    // Count downloaded tickets
    const { count: downloaded } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .not("downloaded_at", "is", null);

    // Count used tickets
    const { count: used } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("status", "USED");

    return NextResponse.json({
      eligible: eligible || 0,
      generated: generated || 0,
      downloaded: downloaded || 0,
      used: used || 0,
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats." },
      { status: 500 }
    );
  }
}
