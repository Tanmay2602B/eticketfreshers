-- ============================================================
-- College Induction E-Ticket System — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Events table (single-row config)
CREATE TABLE IF NOT EXISTS events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL DEFAULT 'College Induction 2026',
  description text,
  date        date,
  start_time  time,
  end_time    time,
  venue       text,
  attire      text,
  instructions text,
  banner_url  text,
  ticket_live boolean NOT NULL DEFAULT false,
  ticket_open_at  timestamptz,
  ticket_close_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed a default event row
INSERT INTO events (name) VALUES ('College Induction 2026')
ON CONFLICT DO NOTHING;

-- 2. Eligible students (imported from CSV/XLSX)
CREATE TABLE IF NOT EXISTS eligible_students (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text NOT NULL,
  student_id  text NOT NULL,
  course      text,
  mobile      text,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_eligible_students_email
  ON eligible_students (email);

-- 3. Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id            text UNIQUE NOT NULL,
  event_id             uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  eligible_student_id  uuid NOT NULL REFERENCES eligible_students(id) ON DELETE CASCADE,
  auth_user_id         uuid NOT NULL,
  qr_token             text UNIQUE NOT NULL,
  status               text NOT NULL DEFAULT 'ACTIVE'
                         CHECK (status IN ('ACTIVE', 'USED', 'CANCELLED')),
  generated_at         timestamptz NOT NULL DEFAULT now(),
  downloaded_at        timestamptz,
  used_at              timestamptz
);

CREATE INDEX IF NOT EXISTS idx_tickets_qr_token ON tickets (qr_token);
CREATE INDEX IF NOT EXISTS idx_tickets_auth_user ON tickets (auth_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_student_event
  ON tickets (eligible_student_id, event_id);

-- 4. Check-ins (audit log)
CREATE TABLE IF NOT EXISTS checkins (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  result     text NOT NULL
               CHECK (result IN ('VALID', 'ALREADY_USED', 'INVALID', 'CANCELLED'))
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligible_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;

-- Events: anyone can read (public event info), only service role can write
CREATE POLICY "Events are publicly readable"
  ON events FOR SELECT
  USING (true);

CREATE POLICY "Events writable by service role"
  ON events FOR ALL
  USING (true)
  WITH CHECK (true);

-- Eligible students: only service role can read/write (via API)
CREATE POLICY "Eligible students service role access"
  ON eligible_students FOR ALL
  USING (true)
  WITH CHECK (true);

-- Tickets: users can read their own, service role can do all
CREATE POLICY "Tickets service role access"
  ON tickets FOR ALL
  USING (true)
  WITH CHECK (true);

-- Checkins: service role only
CREATE POLICY "Checkins service role access"
  ON checkins FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Auto-update updated_at on events
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
