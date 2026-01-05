-- Add account_id column to expenses table for tracking which account was debited
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON public.expenses(account_id);

