'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

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

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }

    // Function to update username from localStorage
    const updateUsername = () => {
      const storedUsername = localStorage.getItem('username');
      setUsername(storedUsername);
      setLoading(false);
    };

    // Initial load
    updateUsername();

    // Listen for storage changes (when username is set in another tab or same tab)
    const handleStorageChange = (e: StorageEvent | Event) => {
      if (e instanceof StorageEvent) {
        if (e.key === 'username') {
          setUsername(e.newValue);
        }
      } else {
        // Custom event from same tab
        updateUsername();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('storage', handleStorageChange as EventListener);

    // Dark mode detection
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => setDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange as EventListener);
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

