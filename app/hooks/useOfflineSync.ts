'use client';

import { useEffect, useState } from 'react';
import { useSupabase } from '../providers';

export function useOfflineSync() {
  const { supabase, user } = useSupabase();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(false);

  useEffect(() => {
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
    if (!user || !isOnline) return;

    try {
      // Get pending items from IndexedDB/localStorage
      const pending = localStorage.getItem('pendingExpenses');
      if (pending) {
        const expenses = JSON.parse(pending);
        for (const expense of expenses) {
          await supabase.from('expenses').insert(expense);
        }
        localStorage.removeItem('pendingExpenses');
        setPendingSync(false);
      }
    } catch (error) {
      console.error('Error syncing pending data:', error);
    }
  };

  return { isOnline, pendingSync, syncPendingData };
}

