# Expenza - Expense Tracker

A production-ready iPhone-like expense tracker web app built with Next.js 14, Tailwind CSS, and Supabase.

## Features

- 🎨 **Native iOS Feel** - Designed to feel like a native iPhone app when added to Home Screen
- 🔐 **Username-Only Auth** - Simple username authentication, no passwords or email verification
- ⚡ **Instant UI Feedback** - Optimistic updates and skeleton loaders
- 🚀 **Zero Full Page Reloads** - Smooth client-side navigation
- 📱 **Bottom Tab Navigation** - iOS-style navigation bar
- 🔄 **Offline-First** - Works offline with service worker caching
- 🌙 **Dark Mode** - Automatic dark mode support
- 📊 **Smart Analytics** - Daily/monthly totals and category breakdowns

## Tech Stack

- **Next.js 14** (App Router)
- **Tailwind CSS** (iOS-style design system)
- **Supabase** (Database + Authentication)
- **TypeScript**
- **PWA** (Progressive Web App)

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- A Supabase account and project

### Setup

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Set up Supabase:**

   - Create a new project at [supabase.com](https://supabase.com)
   - Go to SQL Editor and run the SQL from `supabase/schema.sql`
   - Copy your project URL and anon key

3. **Configure environment variables:**

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Run the development server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Schema

### Profiles Table

```sql
- id: UUID (primary key, references auth.users)
- username: VARCHAR(50) (unique)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Expenses Table

```sql
- id: UUID (primary key)
- user_id: UUID (foreign key to auth.users)
- amount: DECIMAL(10, 2)
- category: VARCHAR(50)
- note: TEXT (optional)
- date: DATE
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

## Row Level Security (RLS)

All expenses are protected by RLS policies:
- Users can only view their own expenses
- Users can only insert/update/delete their own expenses
- All policies use `auth.uid() = user_id` for security

## Authentication Flow

### Username-Only
1. User enters a username (3-20 characters, alphanumeric + underscore)
2. System checks if username is available
3. If available: Creates anonymous Supabase session + profile with username
4. If taken: Shows error message
5. User redirected to home
6. Username is stored and displayed throughout the app

## PWA Configuration

The app is configured as a PWA with:
- `manifest.json` for iOS Home Screen installation
- Service worker for offline caching
- iOS-specific meta tags
- Safe area insets support

### Adding to iPhone Home Screen

1. Open the app in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. The app will launch in standalone mode

## Performance Optimizations

- **Code Splitting** - Automatic with Next.js App Router
- **Optimistic Updates** - Instant UI feedback
- **Skeleton Loaders** - Smooth loading states
- **Service Worker** - Offline caching
- **Image Optimization** - Next.js Image component
- **Bundle Optimization** - Tree-shaking and minification

## Deployment to Vercel

1. **Push to GitHub:**

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin your-repo-url
git push -u origin main
```

2. **Deploy on Vercel:**

   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Deploy!

3. **Update Supabase Redirect URLs:**

   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Add your Vercel URL to "Redirect URLs"
   - Add `https://your-app.vercel.app/auth/callback` to allowed redirect URLs

## iOS-Specific Features

- **Disabled Bounce/Zoom** - Via CSS and viewport meta tags
- **Safe Area Support** - Uses `env(safe-area-inset-*)` for notched devices
- **Haptic Feedback** - Uses Web Vibration API
- **Native Transitions** - Smooth page transitions
- **Standalone Mode** - Full-screen PWA experience

## Project Structure

```
├── app/
│   ├── components/       # Reusable components
│   ├── utils/           # Utility functions
│   ├── auth/           # Authentication pages
│   ├── add/            # Add expense page
│   ├── stats/          # Statistics page
│   ├── settings/       # Settings page
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Home page
│   └── globals.css     # Global styles
├── public/             # Static assets
├── supabase/          # Database schema
└── package.json       # Dependencies
```

## Lighthouse Score

The app is optimized for:
- Performance > 95
- Accessibility > 95
- Best Practices > 95
- SEO > 95

## License

MIT

