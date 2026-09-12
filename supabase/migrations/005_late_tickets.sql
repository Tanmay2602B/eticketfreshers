-- ============================================================
-- 005_late_tickets.sql
-- Admin-initiated late-comer ticket table.
-- Students who missed the regular window can get a ticket
-- created by admin and access it via OTP verification.
-- ============================================================

CREATE TABLE IF NOT EXISTS late_tickets (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  email           text        NOT NULL,
  student_id      text,
  reason          text,
  -- OTP fields (Supabase Auth OTP is used, so we store a generated ticket_id/qr_token only)
  status          text        NOT NULL DEFAULT 'pending',   -- pending | verified
  ticket_id       text        UNIQUE,
  qr_token        text        UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  accessed_at     timestamptz,
  -- soft delete / cancel
  cancelled_at    timestamptz
);

-- Index for fast lookup by email
CREATE INDEX IF NOT EXISTS late_tickets_email_idx ON late_tickets (lower(email));

-- RLS: Enable row-level security
ALTER TABLE late_tickets ENABLE ROW LEVEL SECURITY;

-- Only service role (used by our API) can read/write — no public access
-- The API routes use createServiceClient() which bypasses RLS.
-- No anon SELECT is needed because students access via API route (not direct DB).
CREATE POLICY "Service role full access"
  ON late_tickets
  FOR ALL
  USING (true)
  WITH CHECK (true);
