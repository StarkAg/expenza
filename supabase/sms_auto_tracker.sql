-- ============================================
-- AUTO EXPENSE TRACKER (SMS INGEST)
-- ============================================
-- Run in the EXISTING Expenza project's SQL Editor.
-- Safe to re-run (all statements are IF NOT EXISTS / OR REPLACE).
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for digest() used by the dedupe helper

-- ============================================
-- 1. EXPENSES: provenance + de-duplication
-- ============================================
-- source: how the row got here. Existing rows default to 'manual'.
--   manual        - typed into /add by hand
--   sms_auto      - parsed from SMS and auto-inserted (confidence >= threshold)
--   sms_confirmed - parsed from SMS, then confirmed by the user in the inbox
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual';

-- sms_ref: stable fingerprint of the originating message, so the same SMS
-- delivered twice (bank resend, Shortcut retry, app reinstall) cannot create
-- two expenses. NULL for manual rows.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS sms_ref TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_username_sms_ref
  ON public.expenses(username, sms_ref)
  WHERE sms_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_source ON public.expenses(source);

-- ============================================
-- 1b. ACCOUNTS: last 4 digits, for matching SMS to an account
-- ============================================
-- Bank SMS identify the account as "A/c XX4821". Without these digits stored,
-- an incoming message cannot be tied to an account, and auto-add is skipped
-- (a transaction with no account cannot update a balance). Fill this in on the
-- Accounts screen for every account you want auto-tracked.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS last4 VARCHAR(4);

-- ============================================
-- 2. INGEST TOKENS (one per device)
-- ============================================
-- The raw token is shown to the user exactly once, at creation, and is never
-- stored. Only its SHA-256 hash lives here, so a database leak does not hand
-- the attacker a working ingest credential.
CREATE TABLE IF NOT EXISTS public.ingest_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  label VARCHAR(60) NOT NULL,                    -- "Harsh's iPhone", "Pixel 8"
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'other')),
  token_hash TEXT NOT NULL UNIQUE,               -- sha256 hex of the raw token
  token_hint VARCHAR(12) NOT NULL,               -- last 6 chars, to identify it in the UI
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_ingest_tokens_username ON public.ingest_tokens(username);
CREATE INDEX IF NOT EXISTS idx_ingest_tokens_hash ON public.ingest_tokens(token_hash);

-- ============================================
-- 3. PENDING TRANSACTIONS (the review inbox)
-- ============================================
CREATE TABLE IF NOT EXISTS public.pending_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  username VARCHAR(50) NOT NULL,

  -- what we parsed
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('debit', 'credit')),
  merchant VARCHAR(120),
  account_last4 VARCHAR(8),
  occurred_on DATE NOT NULL,

  -- what we guessed
  suggested_category VARCHAR(50),
  matched_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  confidence DECIMAL(3, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),

  -- provenance
  source VARCHAR(20) NOT NULL CHECK (source IN ('ios_shortcut', 'android_sms', 'manual_test')),
  sender VARCHAR(40),           -- SMS sender ID, e.g. "AD-HDFCBK"
  sms_ref TEXT NOT NULL,        -- same fingerprint scheme as expenses.sms_ref
  raw_text TEXT,                -- ONLY populated for ios_shortcut; see note below
  parser_rule VARCHAR(40),      -- which rule matched, for debugging misparses

  -- lifecycle
  status VARCHAR(12) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(username, sms_ref)
);

-- NOTE ON raw_text: Google Play's Spyware Policy forbids budgeting apps from
-- exfiltrating non-financial SMS history. The Android client therefore parses
-- on-device and posts only extracted fields -- raw_text stays NULL for
-- source='android_sms'. The iOS path runs inside the user's own Shortcut, which
-- is their automation rather than our app's SMS permission, so it may post raw
-- text for server-side parsing.

CREATE INDEX IF NOT EXISTS idx_pending_username_status
  ON public.pending_transactions(username, status);
CREATE INDEX IF NOT EXISTS idx_pending_username_created
  ON public.pending_transactions(username, created_at DESC);

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================
-- Unlike the older tables, these two stay LOCKED. RLS is enabled with no
-- policies, so the public anon key (which ships in the browser bundle) cannot
-- read or write them at all. Only the service_role key -- used exclusively in
-- /api/ingest and /api/pending on the server -- bypasses RLS.
--
-- This matters most for ingest_tokens: those hashes must never be readable by
-- a client holding the anon key.
ALTER TABLE public.ingest_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. updated_at TRIGGER
-- ============================================
-- update_updated_at_column() is already defined by COMPLETE_SCHEMA.sql.
DROP TRIGGER IF EXISTS update_pending_transactions_updated_at ON public.pending_transactions;
CREATE TRIGGER update_pending_transactions_updated_at
  BEFORE UPDATE ON public.pending_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
