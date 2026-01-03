-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing expenses table if it exists (to recreate with new structure)
DROP TABLE IF EXISTS public.expenses CASCADE;

-- Create expenses table with username
CREATE TABLE public.expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  category VARCHAR(50) NOT NULL,
  note TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_expenses_username ON public.expenses(username);
CREATE INDEX idx_expenses_date ON public.expenses(date);
CREATE INDEX idx_expenses_username_date ON public.expenses(username, date);

-- Enable Row Level Security
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Disable RLS for now (since we're using username directly)
-- You can enable it later if needed with username-based policies
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS update_expenses_updated_at ON public.expenses;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

