-- Migration: Add boys and girls separate attire columns to events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS attire_boys  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS attire_girls TEXT DEFAULT NULL;
