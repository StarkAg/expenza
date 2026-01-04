# Quick Start Guide

Get your Expenza expense tracker up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- A Supabase account (free tier works)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait ~2 minutes for provisioning
3. Go to **SQL Editor** in the dashboard
4. Copy the entire contents of `supabase/schema.sql`
5. Paste and click **Run**
6. Go to **Settings** → **API**
7. Copy your **Project URL** and **anon public key**

## Step 3: Configure Environment

Create `.env.local` in the root directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 4: Create PWA Icons (Required)

The app needs icon files for PWA installation. Create or download:

- `public/icon-192.png` (192x192 pixels)
- `public/icon-512.png` (512x512 pixels)

See `scripts/generate-icons.md` for detailed instructions.

**Quick placeholder option:**
- Use any 192x192 and 512x512 images
- Or create simple colored squares in any image editor
- Place them in the `public/` folder

## Step 5: Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Step 6: Test the App

1. **Test Authentication:**
   - Try "Continue Anonymously" (instant)
   - Or enter an email for magic link

2. **Add an Expense:**
   - Click the "Add" tab
   - Fill in amount, category, date
   - Submit

3. **View Statistics:**
   - Check home page for daily/monthly totals
   - View category breakdown
   - Check stats page for detailed analytics

4. **Test Offline:**
   - Open DevTools → Network → Offline
   - Add an expense (should work)
   - Go back online (should sync)

## Step 7: Test on iPhone (Optional)

1. Deploy to Vercel (see DEPLOYMENT.md)
2. Open in Safari on iPhone
3. Tap Share → Add to Home Screen
4. Launch from Home Screen
5. Verify it works in standalone mode

## Troubleshooting

### "Supabase client not initialized"
- Check that `.env.local` exists and has correct values
- Restart the dev server after adding env vars

### "Failed to fetch" errors
- Verify Supabase project is active
- Check that schema.sql was run successfully
- Verify RLS policies are enabled

### Icons not showing
- Ensure `icon-192.png` and `icon-512.png` exist in `public/`
- Check file sizes are correct
- Clear browser cache

### Build errors
- Run `npm install` again
- Delete `.next` folder and rebuild
- Check Node.js version (needs 18+)

## Next Steps

- Deploy to Vercel (see DEPLOYMENT.md)
- Customize categories in `app/add/page.tsx`
- Add your own app icons
- Configure custom domain (optional)

## Need Help?

- Check `README.md` for detailed documentation
- See `ARCHITECTURE.md` for technical details
- Review `DEPLOYMENT.md` for production setup


