-- Create printer_expenses and printer_cartridges tables for tracking printer usage

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Printer expenses table (per print job)
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

-- Printer cartridges table (per cartridge replacement)
CREATE TABLE IF NOT EXISTS public.printer_cartridges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('black_white', 'color')),
  cost DECIMAL(10, 2) NOT NULL CHECK (cost >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_printer_expenses_username ON public.printer_expenses(username);
CREATE INDEX IF NOT EXISTS idx_printer_expenses_username_date ON public.printer_expenses(username, date);
CREATE INDEX IF NOT EXISTS idx_printer_cartridges_username ON public.printer_cartridges(username);
CREATE INDEX IF NOT EXISTS idx_printer_cartridges_username_date ON public.printer_cartridges(username, date);

-- Enable Row Level Security (but disable for now, similar to other tables)
ALTER TABLE public.printer_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printer_cartridges ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.printer_expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.printer_cartridges DISABLE ROW LEVEL SECURITY;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_printer_expenses_updated_at ON public.printer_expenses;
CREATE TRIGGER update_printer_expenses_updated_at
  BEFORE UPDATE ON public.printer_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_printer_cartridges_updated_at ON public.printer_cartridges;
CREATE TRIGGER update_printer_cartridges_updated_at
  BEFORE UPDATE ON public.printer_cartridges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


