'use client';

import { useEffect, useState } from 'react';
import { useSupabase } from '../providers';

export function useOfflineSync() {
  const { supabase, username } = useSupabase();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setPendingSync(true);
      // Trigger sync when coming back online
      syncPendingData();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncPendingData = async () => {
    if (typeof window === 'undefined' || !username || !isOnline) return;

    try {
      // Get pending items from localStorage
      const pending = localStorage.getItem('pendingExpenses');
      if (pending) {
        const expenses = JSON.parse(pending);
        const pendingForUser = expenses.filter((e: any) => e.username === username);
        for (const expense of pendingForUser) {
          await supabase.from('expenses').insert(expense);
        }
        // Remove synced items
        const remaining = expenses.filter((e: any) => e.username !== username);
        if (remaining.length > 0) {
          localStorage.setItem('pendingExpenses', JSON.stringify(remaining));
        } else {
          localStorage.removeItem('pendingExpenses');
        }
        setPendingSync(false);
      }
    } catch (error) {
      console.error('Error syncing pending data:', error);
    }
  };

  return { isOnline, pendingSync, syncPendingData };
}

