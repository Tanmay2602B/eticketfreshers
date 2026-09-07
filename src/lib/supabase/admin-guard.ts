import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Verifies the incoming request is from the designated admin user.
 * Returns { error: NextResponse } if not authorized, or { user } if ok.
 */
export async function requireAdmin(): Promise<
  | { authorized: true; error?: never }
  | { authorized: false; error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authorized: false,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && user.email !== adminEmail) {
    return {
      authorized: false,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { authorized: true };
}
