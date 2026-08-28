'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from '../providers';

export interface PendingTransaction {
  id: string;
  amount: string;
  direction: 'debit' | 'credit';
  merchant: string | null;
  account_last4: string | null;
  occurred_on: string;
  suggested_category: string | null;
  matched_account_id: string | null;
  confidence: string;
  source: string;
  sender: string | null;
  status: 'pending' | 'confirmed' | 'dismissed';
  expense_id: string | null;
  created_at: string;
  parser_rule: string | null;
}

export type LiveMode = 'connecting' | 'live' | 'polling';

/**
 * Keeps the SMS inbox current without a manual refresh.
 *
 * Two mechanisms, deliberately: a Supabase Realtime subscription pushes changes
 * the instant they land, and a poll runs underneath as a safety net. If realtime
 * is unavailable -- the table not yet published, a websocket blocked by a
 * network, a dropped connection -- the poll interval tightens and the feature
 * still works, just a few seconds slower. The UI reports which mode is active
 * rather than silently going stale.
 */
export function usePendingLive(username: string | null, status: string = 'pending') {
  const { supabase } = useSupabase();

  const [transactions, setTransactions] = useState<PendingTransaction[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<LiveMode>('connecting');

  // Held in a ref so the polling effect does not restart on every refresh.
  const refreshRef = useRef<() => void>(() => {});

  const refresh = useCallback(async () => {
    if (!username) return;
    try {
      const res = await fetch(
        `/api/pending?username=${encodeURIComponent(username)}&status=${status}`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load');
      const data = await res.json();
      setTransactions(data.transactions || []);
      setPendingCount(data.pendingCount || 0);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Could not load transactions');
    } finally {
      setLoading(false);
    }
  }, [username, status]);

  refreshRef.current = refresh;

  // Initial load, and reload when the tab/status changes.
  useEffect(() => {
    if (!username) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
  }, [username, status, refresh]);

  // ---- Realtime ----
  useEffect(() => {
    if (!username) return;

    const channel = supabase
      .channel(`pending-${username}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_transactions',
          filter: `username=eq.${username}`,
        },
        () => {
          // Re-fetch rather than patching local state from the payload: the row
          // the server returns has joins and computed fields the payload lacks.
          refreshRef.current();
        }
      )
      .subscribe((subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          setMode('live');
        } else if (
          subStatus === 'CHANNEL_ERROR' ||
          subStatus === 'TIMED_OUT' ||
          subStatus === 'CLOSED'
        ) {
          // Most likely the table is not in the supabase_realtime publication
          // yet, or RLS denies the read. Polling covers it.
          setMode('polling');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, username]);

  // ---- Polling safety net ----
  useEffect(() => {
    if (!username) return;
    // Tight when realtime is not carrying updates, relaxed when it is.
    const interval = mode === 'live' ? 60_000 : 10_000;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      refreshRef.current();
    }, interval);
    return () => clearInterval(id);
  }, [username, mode]);

  // ---- Refresh when the user comes back to the app ----
  useEffect(() => {
    if (!username) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshRef.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [username]);

  return { transactions, pendingCount, loading, error, mode, refresh, setTransactions };
}
