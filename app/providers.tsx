'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useServiceWorkerUpdate } from './hooks/useServiceWorkerUpdate';
import { checkAndProcessFixedExpenses } from './utils/fixedExpenses';

type ThemeMode = 'light' | 'dark' | 'system';

const SupabaseContext = createContext<{
  supabase: SupabaseClient;
  username: string | null;
  loading: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
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
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
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

    // Load theme preference from localStorage
    const storedTheme = localStorage.getItem('theme_mode') as ThemeMode | null;
    const initialTheme: ThemeMode = (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') 
      ? storedTheme 
      : 'system';
    
    setThemeModeState(initialTheme);

    // Apply theme immediately based on stored preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    if (initialTheme === 'light') {
      setDarkMode(false);
    } else if (initialTheme === 'dark') {
      setDarkMode(true);
    } else {
      // system mode
      setDarkMode(mediaQuery.matches);
    }

    // Initial load
    updateUsername();

    // Check and process fixed expenses daily
    checkAndProcessFixedExpenses();

    // Listen for storage changes (when username is set in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'username') {
        setUsername(e.newValue);
      } else if (e.key === 'theme_mode') {
        // Reload theme if changed in another tab
        const newTheme = e.newValue as ThemeMode | null;
        if (newTheme === 'light' || newTheme === 'dark' || newTheme === 'system') {
          setThemeModeState(newTheme);
          if (newTheme === 'light') {
            setDarkMode(false);
          } else if (newTheme === 'dark') {
            setDarkMode(true);
          } else {
            setDarkMode(mediaQuery.matches);
          }
        }
      }
    };
    
    // Listen for custom event (when username is set in same tab)
    const handleUsernameUpdate = () => {
      updateUsername();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('username-updated', handleUsernameUpdate);

    // Dark mode detection (system) - listen for system theme changes
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      // Only update if current theme mode is 'system'
      const currentTheme = localStorage.getItem('theme_mode') as ThemeMode | null;
      if (currentTheme === 'system') {
        setDarkMode(e.matches);
      }
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('username-updated', handleUsernameUpdate);
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []); // Run only once on mount

  // Public setter that also persists to localStorage
  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme_mode', mode);
    }

    if (mode === 'light') {
      setDarkMode(false);
    } else if (mode === 'dark') {
      setDarkMode(true);
    } else if (mode === 'system' && typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setDarkMode(mediaQuery.matches);
    }
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <SupabaseContext.Provider value={{ supabase, username, loading, themeMode, setThemeMode }}>
      {children}
    </SupabaseContext.Provider>
  );
}

