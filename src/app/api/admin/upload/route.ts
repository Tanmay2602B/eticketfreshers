import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import type { UploadRow } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (!guard.authorized) return guard.error;
    const body = await request.json();
    const rows: UploadRow[] = body.rows;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No data provided." },
        { status: 400 }
      );
    }

    const errors: string[] = [];
    const validRows: UploadRow[] = [];
    const seenEmails = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 for 1-indexed + header row

      // Validate required fields
      if (!row.name || typeof row.name !== "string" || !row.name.trim()) {
        errors.push(`Row ${rowNum}: Missing or invalid name`);
        continue;
      }
      if (!row.email || typeof row.email !== "string" || !row.email.includes("@")) {
        errors.push(`Row ${rowNum}: Missing or invalid email`);
        continue;
      }
      if (!row.student_id || typeof row.student_id !== "string" || !String(row.student_id).trim()) {
        errors.push(`Row ${rowNum}: Missing or invalid student_id`);
        continue;
      }

      const email = row.email.trim().toLowerCase();

      // Check duplicate within upload
      if (seenEmails.has(email)) {
        continue; // Silently skip duplicate
      }
      seenEmails.add(email);

      validRows.push({
        name: row.name.trim(),
        email,
        student_id: String(row.student_id).trim(),
        course: row.course ? String(row.course).trim() : undefined,
        mobile: row.mobile ? String(row.mobile).trim() : undefined,
      });
    }

    if (validRows.length === 0) {
      return NextResponse.json(
        {
          error: "No valid rows found in the uploaded data.",
          summary: {
            total: rows.length,
            imported: 0,
            duplicatesRemoved: rows.length - validRows.length,
            errors,
          },
        },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Clear existing eligible students
    await supabase.from("eligible_students").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Insert new data in batches
    const batchSize = 100;
    let imported = 0;

    for (let i = 0; i < validRows.length; i += batchSize) {
      const batch = validRows.slice(i, i + batchSize).map((r) => ({
        name: r.name,
        email: r.email,
        student_id: r.student_id,
        course: r.course || null,
        mobile: r.mobile || null,
      }));

      const { error: insertError, data: inserted } = await supabase
        .from("eligible_students")
        .insert(batch)
        .select("id");

      if (insertError) {
        console.error("Batch insert error:", insertError);
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`);
      } else {
        imported += inserted?.length || 0;
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: rows.length,
        imported,
        duplicatesRemoved: rows.length - validRows.length - errors.length,
        errors,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process upload." },
      { status: 500 }
    );
  }
}
