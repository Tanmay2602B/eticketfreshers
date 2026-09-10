-- ============================================================
-- 003_production_security_hardening.sql
-- Production Row Level Security (RLS) Hardening
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Ensure RLS is enabled on all tables
ALTER TABLE IF EXISTS events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS eligible_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS checkins ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Events are publicly readable" ON events;
DROP POLICY IF EXISTS "Events writable by service role" ON events;
DROP POLICY IF EXISTS "Eligible students service role access" ON eligible_students;
DROP POLICY IF EXISTS "Tickets service role access" ON tickets;
DROP POLICY IF EXISTS "Checkins service role access" ON checkins;
DROP POLICY IF EXISTS "events_select_public" ON events;
DROP POLICY IF EXISTS "eligible_students_select_own" ON eligible_students;
DROP POLICY IF EXISTS "tickets_select_own" ON tickets;

-- 3. Events Policies
-- Anyone (authenticated or anonymous) can view event information (date, venue, instructions)
CREATE POLICY "events_select_public"
  ON events FOR SELECT
  USING (true);

-- No client-side INSERT/UPDATE/DELETE (service role bypasses RLS)

-- 4. Eligible Students Policies
-- Authenticated students can ONLY read their own student record
CREATE POLICY "eligible_students_select_own"
  ON eligible_students FOR SELECT
  TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- Direct client modification is strictly forbidden
-- No INSERT, UPDATE, or DELETE policies are granted to authenticated or anon.

-- 5. Tickets Policies
-- Authenticated users can ONLY view their own ticket
CREATE POLICY "tickets_select_own"
  ON tickets FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Direct client modification of tickets is strictly forbidden:
-- Students cannot alter ticket_id, qr_token, status, or timestamps.
-- All ticket creation and updates happen exclusively server-side with service role.

-- 6. Checkins Policies
-- Checkins are an audit log reserved solely for the administrative scanner via service role.
-- No policies granted to anon or authenticated = zero direct client access.
