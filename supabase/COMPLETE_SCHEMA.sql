-- ============================================
-- COMPLETE SUPABASE SCHEMA FOR EXPENZA
-- ============================================
-- Run this file in Supabase SQL Editor to set up all tables
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. EXPENSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  category VARCHAR(50) NOT NULL,
  note TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_username ON public.expenses(username);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_username_date ON public.expenses(username, date);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. ACCOUNTS TABLE (Banks & Credit Cards)
-- ============================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('credit_card', 'bank')),
  balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_username ON public.accounts(username);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. FIXED EXPENSES TABLE (Monthly Recurring)
-- ============================================
CREATE TABLE IF NOT EXISTS public.fixed_expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  category VARCHAR(50) NOT NULL,
  day_of_month INTEGER NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_username ON public.fixed_expenses(username);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_day_of_month ON public.fixed_expenses(day_of_month);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_active ON public.fixed_expenses(is_active);

ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_expenses DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. CATEGORIES TABLE (With Colors)
-- ============================================
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#FF6B6B',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(username, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_username ON public.categories(username);
CREATE INDEX IF NOT EXISTS idx_categories_username_order ON public.categories(username, display_order);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. PRINTER EXPENSES TABLE (Print Jobs)
-- ============================================
CREATE TABLE IF NOT EXISTS public.printer_expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  pages INTEGER NOT NULL CHECK (pages > 0),
  type VARCHAR(20) NOT NULL CHECK (type IN ('black_white', 'color')),
  cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  expense_id UUID, -- optional link to expenses.id if needed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_printer_expenses_username ON public.printer_expenses(username);
CREATE INDEX IF NOT EXISTS idx_printer_expenses_username_date ON public.printer_expenses(username, date);

ALTER TABLE public.printer_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printer_expenses DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. PRINTER CARTRIDGES TABLE (Cartridge Replacements)
-- ============================================
CREATE TABLE IF NOT EXISTS public.printer_cartridges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('black_white', 'color')),
  cost DECIMAL(10, 2) NOT NULL CHECK (cost >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_printer_cartridges_username ON public.printer_cartridges(username);
CREATE INDEX IF NOT EXISTS idx_printer_cartridges_username_date ON public.printer_cartridges(username, date);

ALTER TABLE public.printer_cartridges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printer_cartridges DISABLE ROW LEVEL SECURITY;

-- ============================================
-- UPDATE_TIMED_AT FUNCTION (for all tables)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- TRIGGERS (Auto-update updated_at)
-- ============================================

-- Expenses
DROP TRIGGER IF EXISTS update_expenses_updated_at ON public.expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Accounts
DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Fixed Expenses
DROP TRIGGER IF EXISTS update_fixed_expenses_updated_at ON public.fixed_expenses;
CREATE TRIGGER update_fixed_expenses_updated_at
  BEFORE UPDATE ON public.fixed_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Categories
DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Printer Expenses
DROP TRIGGER IF EXISTS update_printer_expenses_updated_at ON public.printer_expenses;
CREATE TRIGGER update_printer_expenses_updated_at
  BEFORE UPDATE ON public.printer_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Printer Cartridges
DROP TRIGGER IF EXISTS update_printer_cartridges_updated_at ON public.printer_cartridges;
CREATE TRIGGER update_printer_cartridges_updated_at
  BEFORE UPDATE ON public.printer_cartridges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SUMMARY
-- ============================================
-- All tables created:
-- ✅ expenses - Main expense tracking
-- ✅ accounts - Banks & credit cards
-- ✅ fixed_expenses - Monthly recurring expenses
-- ✅ categories - Categories with colors
-- ✅ printer_expenses - Print job tracking
-- ✅ printer_cartridges - Cartridge replacements
-- ============================================

