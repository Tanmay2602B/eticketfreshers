-- ============================================================
-- Fix RLS Policies — Replace overly-permissive defaults
-- Run this in Supabase SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. Drop all existing permissive policies
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Events are publicly readable" ON events;
DROP POLICY IF EXISTS "Events writable by service role" ON events;
DROP POLICY IF EXISTS "Eligible students service role access" ON eligible_students;
DROP POLICY IF EXISTS "Tickets service role access" ON tickets;
DROP POLICY IF EXISTS "Checkins service role access" ON checkins;

-- ──────────────────────────────────────────────────────────────
-- 2. Events — publicly readable, no client-side writes
-- ──────────────────────────────────────────────────────────────

-- Anyone (including anon) can read event info
CREATE POLICY "events_select_public"
  ON events FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE via client — admin uses service role
-- (Service role bypasses RLS entirely, so no policy needed)

-- ──────────────────────────────────────────────────────────────
-- 3. Eligible Students — students can read only their own row
-- ──────────────────────────────────────────────────────────────

-- Authenticated users can read ONLY their own row (matched by email)
CREATE POLICY "eligible_students_select_own"
  ON eligible_students FOR SELECT
  TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- No INSERT/UPDATE/DELETE via client — admin uses service role

-- ──────────────────────────────────────────────────────────────
-- 4. Tickets — students can read only their own ticket
-- ──────────────────────────────────────────────────────────────

-- Authenticated users can read ONLY their own ticket
CREATE POLICY "tickets_select_own"
  ON tickets FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- No INSERT/UPDATE/DELETE via client — server API uses service role

-- ──────────────────────────────────────────────────────────────
-- 5. Checkins — no client access at all
-- ──────────────────────────────────────────────────────────────

-- No policies = no client access. Service role bypasses RLS.
-- (RLS is already enabled on checkins from the initial migration)
