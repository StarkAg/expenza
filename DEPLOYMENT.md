# Deployment Guide

## Prerequisites

- GitHub account
- Vercel account (free tier works)
- Supabase account (free tier works)

## Step 1: Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be provisioned (takes ~2 minutes)
3. Go to **SQL Editor** in the Supabase dashboard
4. Copy and paste the contents of `supabase/schema.sql`
5. Click **Run** to execute the SQL
6. Go to **Settings** → **API** and copy:
   - Project URL
   - `anon` `public` key

## Step 2: Push to GitHub

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Expenza Expense Tracker"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/yourusername/expenza.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **Add New Project**
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
5. Add Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Your Supabase anon key
6. Click **Deploy**

## Step 4: Configure Supabase Redirect URLs

1. Go back to Supabase Dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Add your Vercel URL to **Site URL**: `https://your-app.vercel.app`
4. Add to **Redirect URLs**:
   - `https://your-app.vercel.app/auth/callback`
   - `https://your-app.vercel.app/**` (wildcard for all routes)

## Step 5: Add PWA Icons

The app expects icon files at:
- `/public/icon-192.png` (192x192)
- `/public/icon-512.png` (512x512)

You can:
1. Create icons using a tool like [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator)
2. Or use placeholder icons for now

## Step 6: Test the Deployment

1. Visit your Vercel URL
2. Test authentication (magic link or anonymous)
3. Add an expense
4. Test on iPhone Safari:
   - Open the app
   - Tap Share → Add to Home Screen
   - Launch from Home Screen
   - Verify it works in standalone mode

## Troubleshooting

### Authentication not working
- Check that redirect URLs are correctly configured in Supabase
- Verify environment variables are set in Vercel
- Check browser console for errors

### Database errors
- Verify RLS policies are enabled
- Check that the schema was created correctly
- Ensure the user is authenticated

### PWA not installing
- Check that manifest.json is accessible
- Verify icons exist and are the correct size
- Test in Safari on iOS (Chrome doesn't support PWA installation on iOS)

### Build errors
- Check that all dependencies are in `package.json`
- Verify TypeScript types are correct
- Check Vercel build logs for specific errors

## Performance Optimization

After deployment, check Lighthouse scores:
1. Open Chrome DevTools
2. Go to Lighthouse tab
3. Run audit on mobile
4. Target scores: >95 for all categories

Common optimizations:
- Enable Vercel Analytics
- Use Next.js Image component for any images
- Minimize bundle size (already optimized)
- Enable compression in Vercel settings

## Custom Domain (Optional)

1. In Vercel dashboard, go to **Settings** → **Domains**
2. Add your custom domain
3. Update Supabase redirect URLs to include your custom domain
4. DNS will be configured automatically by Vercel

