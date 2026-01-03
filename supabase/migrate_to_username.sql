-- Migration script: Convert user_id to username
-- Only run this if you want to keep existing data

-- Step 1: Add username column
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS username VARCHAR(50);

-- Step 2: If you have existing data with user_id, you'll need to map them to usernames
-- For now, set a default or update manually:
-- UPDATE public.expenses SET username = 'default_user' WHERE username IS NULL;

-- Step 3: Make username NOT NULL (after setting values)
-- ALTER TABLE public.expenses ALTER COLUMN username SET NOT NULL;

-- Step 4: Drop old user_id column
-- ALTER TABLE public.expenses DROP COLUMN IF EXISTS user_id;

-- Step 5: Recreate indexes
DROP INDEX IF EXISTS idx_expenses_user_id;
DROP INDEX IF EXISTS idx_expenses_user_date;
CREATE INDEX IF NOT EXISTS idx_expenses_username ON public.expenses(username);
CREATE INDEX IF NOT EXISTS idx_expenses_username_date ON public.expenses(username, date);

