# Database Schema Update Required

Since we've updated the authentication to use username-only, you need to update your Supabase database schema.

## Steps

1. Go to your Supabase Dashboard: https://phlggcheaajkupppozho.supabase.co
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the **ENTIRE** contents of `supabase/schema.sql`
5. Click **Run**

This will:
- ✅ Create the `profiles` table for storing usernames
- ✅ Create the `expenses` table
- ✅ Set up all indexes and RLS policies
- ✅ Create the auto-update trigger

## Important Notes

- If you already ran the old schema, you may need to drop the old `expenses` table first (if it exists)
- The new schema includes the `profiles` table which is required for username authentication
- All RLS policies are set up to ensure users can only access their own data

## After Running the Schema

1. Restart your dev server if it's running
2. Try signing in with a username
3. The app should work with the new authentication flow

