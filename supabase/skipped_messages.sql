-- ============================================
-- SKIPPED MESSAGES (parser debug log)
-- ============================================
-- Every message the parser declines to turn into a transaction is recorded
-- here in full, so misparses can be diagnosed and rejection rules tuned against
-- real traffic instead of guesses.
--
-- PRIVACY: this stores the complete text of EVERY message forwarded to
-- /api/ingest, including personal messages that have nothing to do with banking.
-- That is a deliberate choice for a single-user, self-hosted setup. Two
-- consequences worth keeping in mind:
--   1. Google Play's Spyware Policy forbids budgeting apps from exfiltrating
--      non-financial SMS history, so an Android client that posts raw text to
--      this table cannot be published on Play (sideloading is unaffected).
--   2. Before making Expenza multi-user/public, either drop this table or
--      restrict it to bank-sender messages only.
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.skipped_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  raw_text TEXT,
  sender VARCHAR(40),
  -- Why the parser declined: 'rejected:otp', 'no-amount', 'no-direction', ...
  reason VARCHAR(60),
  source VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skipped_username_created
  ON public.skipped_messages(username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skipped_reason
  ON public.skipped_messages(reason);

-- Server-only, like ingest_tokens: RLS on with no policies, so the public anon
-- key shipped in the browser cannot read anyone's message history.
ALTER TABLE public.skipped_messages ENABLE ROW LEVEL SECURITY;
