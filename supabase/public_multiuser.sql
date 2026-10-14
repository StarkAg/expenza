-- ============================================
-- MULTI-USER / PUBLIC RELEASE SCHEMA
-- ============================================
-- Replaces the single-user "username in localStorage" model with real Supabase
-- Auth accounts and per-row isolation enforced by the database.
--
-- BEFORE: every table keyed on username VARCHAR, RLS explicitly DISABLED, and
--         the public anon key could read and write every user's rows.
-- AFTER:  every table keyed on user_id -> auth.users(id), RLS ENABLED with
--         owner-only policies. A user physically cannot read another's data,
--         even holding the anon key and crafting requests by hand.
--
-- DESTRUCTIVE: drops and recreates the six app tables. Safe only because all of
-- them were verified empty (0 rows) at the time this was written. Do NOT run
-- this against a database holding data without migrating rows first.
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Dependency order: children first. CASCADE covers the FK from expenses.
DROP TABLE IF EXISTS public.pending_transactions CASCADE;
DROP TABLE IF EXISTS public.ingest_tokens CASCADE;
DROP TABLE IF EXISTS public.printer_cartridges CASCADE;
DROP TABLE IF EXISTS public.printer_expenses CASCADE;
DROP TABLE IF EXISTS public.fixed_expenses CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;

-- ============================================
-- Shared updated_at trigger function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- 1. ACCOUNTS
-- ============================================
CREATE TABLE public.accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('credit_card', 'bank')),
  balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  last4 VARCHAR(4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_accounts_user ON public.accounts(user_id);

-- ============================================
-- 2. EXPENSES
-- ============================================
CREATE TABLE public.expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  category VARCHAR(50) NOT NULL,
  note TEXT,
  date DATE NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'manual',
  sms_ref TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_expenses_user ON public.expenses(user_id);
CREATE INDEX idx_expenses_user_date ON public.expenses(user_id, date);
CREATE INDEX idx_expenses_account ON public.expenses(account_id);
-- One SMS can only ever become one expense, per user.
CREATE UNIQUE INDEX idx_expenses_user_sms_ref
  ON public.expenses(user_id, sms_ref) WHERE sms_ref IS NOT NULL;

-- ============================================
-- 3. CATEGORIES
-- ============================================
CREATE TABLE public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#FF6B6B',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);
CREATE INDEX idx_categories_user_order ON public.categories(user_id, display_order);

-- ============================================
-- 4. FIXED EXPENSES
-- ============================================
CREATE TABLE public.fixed_expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  category VARCHAR(50) NOT NULL,
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_fixed_expenses_user ON public.fixed_expenses(user_id);

-- ============================================
-- 5. PRINTER MODULE
-- ============================================
CREATE TABLE public.printer_expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  pages INTEGER NOT NULL CHECK (pages > 0),
  type VARCHAR(20) NOT NULL CHECK (type IN ('black_white', 'color')),
  cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_printer_expenses_user_date ON public.printer_expenses(user_id, date);

CREATE TABLE public.printer_cartridges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('black_white', 'color')),
  cost DECIMAL(12, 2) NOT NULL CHECK (cost >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_printer_cartridges_user_date ON public.printer_cartridges(user_id, date);

-- ============================================
-- 6. INGEST TOKENS  (server-only)
-- ============================================
CREATE TABLE public.ingest_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label VARCHAR(60) NOT NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'other')),
  token_hash TEXT NOT NULL UNIQUE,
  token_hint VARCHAR(12) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_ingest_tokens_user ON public.ingest_tokens(user_id);
CREATE INDEX idx_ingest_tokens_hash ON public.ingest_tokens(token_hash);

-- ============================================
-- 7. PENDING TRANSACTIONS (review inbox)
-- ============================================
CREATE TABLE public.pending_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('debit', 'credit')),
  merchant VARCHAR(120),
  account_last4 VARCHAR(8),
  occurred_on DATE NOT NULL,
  suggested_category VARCHAR(50),
  matched_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  confidence DECIMAL(3, 2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  source VARCHAR(20) NOT NULL CHECK (source IN ('ios_shortcut', 'android_sms', 'manual_test')),
  sender VARCHAR(40),
  sms_ref TEXT NOT NULL,
  raw_text TEXT,
  parser_rule VARCHAR(40),
  status VARCHAR(12) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, sms_ref)
);
CREATE INDEX idx_pending_user_status ON public.pending_transactions(user_id, status);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
-- Every table is enabled. Policies below grant a user access to their OWN rows
-- only, evaluated by Postgres on every query -- so a stolen anon key, a crafted
-- REST call, or a bug in the client cannot cross the boundary.
ALTER TABLE public.accounts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_expenses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printer_expenses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printer_cartridges   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingest_tokens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_transactions ENABLE ROW LEVEL SECURITY;

-- Owner-may-do-everything, for the tables the client edits directly.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'accounts', 'expenses', 'categories', 'fixed_expenses',
    'printer_expenses', 'printer_cartridges'
  ] LOOP
    EXECUTE format($f$
      CREATE POLICY "owner_all" ON public.%I
        FOR ALL TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    $f$, t);
  END LOOP;
END $$;

-- The inbox is readable by its owner so the UI and the nav badge can query it
-- directly. Writes stay server-side: confirming a transaction also inserts an
-- expense and adjusts an account balance, which must happen as one unit in
-- /api/pending rather than as three unsequenced client calls.
CREATE POLICY "owner_select" ON public.pending_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ingest_tokens deliberately gets NO policy. These are credentials; they are
-- only ever touched by /api/tokens using the service_role key, which bypasses
-- RLS. With RLS on and no policy, the anon and authenticated roles are refused
-- outright.

-- ============================================
-- updated_at TRIGGERS
-- ============================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'accounts', 'expenses', 'categories', 'fixed_expenses',
    'printer_expenses', 'printer_cartridges', 'pending_transactions'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER update_%1$s_updated_at BEFORE UPDATE ON public.%1$I
         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();', t);
  END LOOP;
END $$;

-- ============================================
-- SEED DEFAULT CATEGORIES FOR NEW SIGNUPS
-- ============================================
-- Without this a new user lands on an empty app. Runs as SECURITY DEFINER
-- because the row is created before the user has a session.
CREATE OR REPLACE FUNCTION public.seed_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, color, display_order)
  VALUES
    (NEW.id, 'Food',          '#E23744', 0),
    (NEW.id, 'Transport',     '#000000', 1),
    (NEW.id, 'Shopping',      '#9B870C', 2),
    (NEW.id, 'Bills',         '#5F3DC4', 3),
    (NEW.id, 'Entertainment', '#2F9E44', 4),
    (NEW.id, 'Health',        '#E8590C', 5),
    (NEW.id, 'Other',         '#868E96', 6)
  ON CONFLICT (user_id, name) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_categories();
