'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useServiceWorkerUpdate } from './hooks/useServiceWorkerUpdate';

const SupabaseContext = createContext<{
  supabase: SupabaseClient;
  username: string | null;
  loading: boolean;
} | null>(null);

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within Providers');
  }
  return context;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Enable service worker update detection and auto-refresh
  useServiceWorkerUpdate();

  const [supabase] = useState(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    // Register service worker with better error handling
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', {
          scope: '/',
        })
        .then((registration) => {
          console.log('Service Worker registered:', registration.scope);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }

    // Function to update username from localStorage
    const updateUsername = () => {
      const storedUsername = localStorage.getItem('username');
      setUsername(storedUsername);
      setLoading(false);
    };

    // Initial load
    updateUsername();

    // Listen for storage changes (when username is set in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'username') {
        setUsername(e.newValue);
      }
    };
    
    // Listen for custom event (when username is set in same tab)
    const handleUsernameUpdate = () => {
      updateUsername();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('username-updated', handleUsernameUpdate);

    // Dark mode detection
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => setDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('username-updated', handleUsernameUpdate);
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <SupabaseContext.Provider value={{ supabase, username, loading }}>
      {children}
    </SupabaseContext.Provider>
  );
}

