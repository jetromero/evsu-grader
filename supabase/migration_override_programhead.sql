-- =====================================================================
-- Migration: Add program_head role, program column, and result overrides
-- Run this in the Supabase SQL editor
-- =====================================================================

-- 1. Add 'program' column to profiles (used by program heads)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS program TEXT;

-- 2. Extend the role CHECK constraint to include 'program_head'
--    (drops existing constraint and recreates it)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_role_check'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END$$;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'panelist', 'program_head'));

-- 3. Add override columns to results table
ALTER TABLE results ADD COLUMN IF NOT EXISTS override_verdict TEXT
  CHECK (override_verdict IN ('qualified', 'not_qualified', 'disqualified'));

ALTER TABLE results ADD COLUMN IF NOT EXISTS override_reason TEXT;

ALTER TABLE results ADD COLUMN IF NOT EXISTS override_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE results ADD COLUMN IF NOT EXISTS override_at TIMESTAMPTZ;
