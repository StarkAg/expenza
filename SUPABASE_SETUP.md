# Supabase Configuration

## Enable Anonymous Authentication

The app uses Supabase's anonymous authentication feature. You need to enable it:

1. Go to your Supabase Dashboard: https://phlggcheaajkupppozho.supabase.co
2. Navigate to **Authentication** → **Providers**
3. Scroll down to find **Anonymous** provider
4. Toggle it **ON**
5. Click **Save**

## Run Database Schema

1. Go to **SQL Editor** in Supabase Dashboard
2. Copy the entire contents of `supabase/schema.sql`
3. Paste and click **Run**

This creates:
- `profiles` table (for usernames)
- `expenses` table
- All necessary indexes and RLS policies

## Configure Redirect URLs (For Production)

When you deploy to Vercel:

1. Go to **Authentication** → **URL Configuration**
2. Add your Vercel URL to **Site URL**
3. Add `https://your-app.vercel.app/auth/callback` to **Redirect URLs**

For local development, the default redirect URLs should work.

## Verify Setup

After enabling anonymous auth and running the schema:

1. Try signing in with a username in the app
2. Check that a profile is created in the `profiles` table
3. Verify that expenses can be added and viewed

