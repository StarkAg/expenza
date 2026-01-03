# Architecture Overview

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling with iOS design system
- **Supabase** - Backend as a Service (Database + Auth)
- **PWA** - Progressive Web App for iOS installation

## Project Structure

```
expenza-expense-tracker/
├── app/
│   ├── components/          # Reusable React components
│   │   ├── BottomNav.tsx    # iOS-style bottom navigation
│   │   ├── ExpenseList.tsx  # Expense list with skeleton loaders
│   │   ├── StatsCard.tsx    # Statistics display card
│   │   └── OfflineIndicator.tsx # Offline status indicator
│   ├── hooks/               # Custom React hooks
│   │   └── useOfflineSync.ts # Offline sync logic
│   ├── lib/                 # Utility libraries
│   │   └── supabase.ts      # Supabase client factory
│   ├── utils/               # Utility functions
│   │   └── haptics.ts       # Haptic feedback helper
│   ├── auth/                # Authentication pages
│   │   ├── page.tsx         # Login page (magic link + anonymous)
│   │   └── callback/        # OAuth callback handler
│   ├── add/                 # Add expense page
│   ├── stats/               # Statistics page
│   ├── settings/            # Settings page
│   ├── layout.tsx           # Root layout with PWA meta tags
│   ├── page.tsx             # Home page (server component)
│   ├── home-page.tsx        # Home page (client component)
│   ├── providers.tsx        # Supabase context provider
│   └── globals.css          # Global styles + iOS fixes
├── public/
│   ├── manifest.json        # PWA manifest
│   ├── sw.js               # Service worker
│   ├── icon-192.png        # PWA icon (192x192)
│   └── icon-512.png        # PWA icon (512x512)
├── supabase/
│   └── schema.sql          # Database schema + RLS policies
└── [config files]          # Next.js, TypeScript, Tailwind configs
```

## Data Flow

### Authentication Flow

1. **Magic Link**:
   - User enters email → Supabase sends magic link
   - User clicks link → Redirected to `/auth/callback`
   - Callback exchanges code for session → Redirects to home

2. **Anonymous**:
   - User clicks "Continue Anonymously"
   - Supabase creates anonymous session
   - User redirected to home

### Expense Management Flow

1. **Add Expense**:
   - User fills form → Submits
   - If online: Insert to Supabase → Optimistic update
   - If offline: Store in localStorage → Sync when online
   - Redirect to home

2. **View Expenses**:
   - Load from Supabase (if online)
   - Fallback to localStorage cache (if offline)
   - Merge with pending expenses
   - Display with real-time updates

3. **Delete Expense**:
   - Optimistic update (remove from UI)
   - Delete from Supabase
   - Rollback on error

## Offline-First Architecture

### Strategy

1. **Cache Last Synced Data**:
   - Store expenses in localStorage keyed by user ID
   - Update cache on successful fetch

2. **Queue Pending Changes**:
   - Store pending inserts in localStorage
   - Sync when connection restored

3. **Service Worker**:
   - Cache static assets
   - Serve cached content when offline

4. **Optimistic Updates**:
   - Update UI immediately
   - Sync in background
   - Rollback on error

### Implementation

- **localStorage keys**:
  - `expenses_${userId}` - Cached expense list
  - `pendingExpenses` - Array of pending inserts

- **Sync trigger**:
  - `online` event listener
  - Automatic sync on connection restore

## Security

### Row Level Security (RLS)

All database operations are protected by RLS policies:

```sql
-- Users can only access their own expenses
CREATE POLICY "Users can view their own expenses"
  ON expenses FOR SELECT
  USING (auth.uid() = user_id);
```

### Client-Side Security

- Environment variables for Supabase keys
- No sensitive data in client code
- All auth handled by Supabase

## Performance Optimizations

1. **Code Splitting**:
   - Automatic with Next.js App Router
   - Route-based code splitting

2. **Bundle Optimization**:
   - Tree-shaking enabled
   - SWC minification
   - Optimized package imports

3. **Caching**:
   - Service worker caching
   - localStorage caching
   - Browser HTTP cache

4. **Lazy Loading**:
   - Components loaded on demand
   - Images optimized (when added)

## iOS-Specific Features

### PWA Configuration

- `manifest.json` with iOS-specific settings
- Apple meta tags in layout
- Safe area insets support

### UI/UX Enhancements

- Disabled Safari bounce/zoom
- Haptic feedback via Vibration API
- Smooth transitions
- Native-like navigation

### Viewport Configuration

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
```

## Real-Time Updates

Supabase real-time subscriptions:

```typescript
supabase
  .channel('expenses-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'expenses',
    filter: `user_id=eq.${user.id}`,
  }, () => {
    loadExpenses();
  })
  .subscribe();
```

## State Management

- **React Context** for Supabase client and auth state
- **Local State** for component-specific data
- **localStorage** for offline persistence
- **Supabase Realtime** for live updates

## Error Handling

- Try-catch blocks around async operations
- Fallback to offline storage on network errors
- User-friendly error messages
- Optimistic update rollback on failure

## Testing Considerations

- Test offline scenarios
- Test authentication flows
- Test RLS policies
- Test PWA installation
- Test on actual iOS devices

## Future Enhancements

- IndexedDB for larger offline storage
- Background sync API
- Push notifications
- Export/import functionality
- Multi-currency support
- Recurring expenses
- Budget tracking

