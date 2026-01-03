# Deploy to Vercel

## Step 1: Push to GitHub

1. Create a new repository on GitHub (or use existing)
2. Add the remote and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/expenza-expense-tracker.git
git branch -M main
git push -u origin main
```

Or if you already have a remote:
```bash
git push -u origin main
```

## Step 2: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

5. **Add Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://phlggcheaajkupppozho.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBobGdnY2hlYWFqa3VwcHBvemhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyODQ0NTgsImV4cCI6MjA3ODg2MDQ1OH0.TGEDpm2uqKceOxAMB5aG6fd8uHESmwfdKF-cqm2QU84`

6. Click **"Deploy"**

## Step 3: Update Supabase (if needed)

The app should work with the current Supabase setup. Make sure:
- The `expenses` table exists with `username` column
- RLS is disabled (or configure policies if needed)

## Your app will be live at:
`https://your-project-name.vercel.app`

## Note on Icons

The placeholder icon files are created. For production, replace:
- `public/icon-192.png` (192x192 pixels)
- `public/icon-512.png` (512x512 pixels)

With actual app icons for better PWA experience.

