-- ============================================
-- LIVE INBOX (Supabase Realtime)
-- ============================================
-- Pushes new SMS transactions to the open app over a websocket, so the inbox
-- and the nav badge update without a refresh.
--
-- Realtime delivers rows subject to RLS, so the browser must be able to SELECT
-- the table. Raw SMS text therefore must not live in it -- /api/ingest stops
-- writing pending_transactions.raw_text and keeps every message body in
-- skipped_messages instead, which stays server-only.
-- ============================================

-- Records the outcome alongside the message, so skipped_messages now holds the
-- full text of every message received, parsed or not.
ALTER TABLE public.skipped_messages
  ADD COLUMN IF NOT EXISTS outcome VARCHAR(20) NOT NULL DEFAULT 'ignored';

COMMENT ON TABLE public.skipped_messages IS
  'Every message received by /api/ingest, parsed or not, with its full text. Server-only (RLS on, no policies).';

COMMENT ON COLUMN public.pending_transactions.raw_text IS
  'Deprecated, always NULL for new rows. Message text lives in skipped_messages so it is never exposed to the browser.';

-- Rows written before this change still carry SMS text. Clear it BEFORE the
-- table becomes readable by the browser, otherwise those bodies would be
-- exposed the moment the policy below is created.
UPDATE public.pending_transactions SET raw_text = NULL WHERE raw_text IS NOT NULL;

-- ------------------------------------------------
-- Client read access, required for realtime
-- ------------------------------------------------
-- NOTE: deliberately permissive, because the app is still single-user -- auth is
-- a username in localStorage, so there is no auth.uid() to compare against. This
-- matches the existing model, where expenses, accounts and categories already
-- have RLS disabled outright.
--
-- WHEN GOING MULTI-USER, replace the policy body with:
--     USING (auth.uid() = user_id)
-- and realtime keeps working unchanged -- no client code has to change.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pending_transactions'
      AND policyname = 'read_pending'
  ) THEN
    CREATE POLICY "read_pending" ON public.pending_transactions
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- Writes stay server-side: confirming a transaction also inserts an expense and
-- adjusts an account balance, which must happen together in /api/pending.

-- ------------------------------------------------
-- Publish for realtime
-- ------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pending_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_transactions;
  END IF;
END $$;

-- UPDATE/DELETE events carry the old row only under full replica identity, which
-- the inbox needs in order to drop a row the moment it is confirmed elsewhere.
ALTER TABLE public.pending_transactions REPLICA IDENTITY FULL;
