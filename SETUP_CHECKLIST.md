# Setup Checklist ✅

## ✅ Step 1: Environment Variables
- [x] Created `.env.local` with your Supabase credentials

## ⏳ Step 2: Set Up Database Schema

1. Go to your Supabase Dashboard: https://phlggcheaajkupppozho.supabase.co
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy the entire contents of `supabase/schema.sql`
5. Paste into the SQL Editor
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. Verify success - you should see "Success. No rows returned"

This will create:
- ✅ `expenses` table
- ✅ Indexes for performance
- ✅ Row Level Security (RLS) policies
- ✅ Auto-update trigger for `updated_at`

## ⏳ Step 3: Install Dependencies

```bash
npm install
```

## ⏳ Step 4: Create PWA Icons (Required for iOS Installation)

You need two icon files:
- `public/icon-192.png` (192x192 pixels)
- `public/icon-512.png` (512x512 pixels)

**Quick Options:**

1. **Use an online generator:**
   - Go to https://realfavicongenerator.net/
   - Upload a 512x512 image
   - Download generated icons
   - Place in `public/` folder

2. **Create simple placeholders:**
   - Use any image editor
   - Create 192x192 and 512x512 colored squares
   - Save as `icon-192.png` and `icon-512.png`
   - Place in `public/` folder

3. **Use command line (if you have ImageMagick):**
   ```bash
   convert -size 512x512 xc:#007AFF public/icon-512.png
   convert -size 192x192 xc:#007AFF public/icon-192.png
   ```

## ⏳ Step 5: Run Development Server

```bash
npm run dev
```

Then open http://localhost:3000 in your browser.

## ⏳ Step 6: Test the App

1. **Authentication:**
   - Try "Continue Anonymously" (instant login)
   - Or enter your email for magic link

2. **Add Expense:**
   - Click "Add" tab
   - Enter amount, select category, choose date
   - Submit

3. **View Data:**
   - Check home page for totals
   - View category breakdown
   - See recent expenses

4. **Test Offline:**
   - Open DevTools → Network → Offline
   - Add an expense (should work)
   - Go back online (should sync automatically)

## ⏳ Step 7: Configure Supabase Redirect URLs (For Production)

When you deploy to Vercel:

1. Go to Supabase Dashboard → **Authentication** → **URL Configuration**
2. Add to **Site URL**: `https://your-app.vercel.app`
3. Add to **Redirect URLs**:
   - `https://your-app.vercel.app/auth/callback`
   - `https://your-app.vercel.app/**`

## 🎉 You're Ready!

Once you complete steps 2-5, your app will be fully functional!

### Quick Commands Reference

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Troubleshooting

**"Failed to fetch" errors:**
- Make sure you ran the SQL schema in Supabase
- Check that RLS is enabled on the expenses table
- Verify your `.env.local` file has correct values

**Icons not showing:**
- Ensure `icon-192.png` and `icon-512.png` exist in `public/`
- Check file sizes are correct (192x192 and 512x512)
- Clear browser cache

**Build errors:**
- Run `npm install` again
- Delete `.next` folder: `rm -rf .next`
- Rebuild: `npm run build`


