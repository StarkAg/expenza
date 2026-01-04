-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create accounts table for credit cards and bank accounts
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('credit_card', 'bank')),
  balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create fixed_expenses table for recurring monthly expenses
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

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_accounts_username ON public.accounts(username);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_username ON public.fixed_expenses(username);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_day_of_month ON public.fixed_expenses(day_of_month);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_active ON public.fixed_expenses(is_active);

-- Enable Row Level Security (but disable for now, similar to expenses table)
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_expenses DISABLE ROW LEVEL SECURITY;

-- Trigger to automatically update updated_at for accounts
DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at for fixed_expenses
DROP TRIGGER IF EXISTS update_fixed_expenses_updated_at ON public.fixed_expenses;
CREATE TRIGGER update_fixed_expenses_updated_at
  BEFORE UPDATE ON public.fixed_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

