'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '../providers';
import BottomNav from '../components/BottomNav';
import { hapticFeedback } from '../utils/haptics';
import { formatCurrency } from '../utils/currency';
import { getCategories, type Category } from '../utils/categories';
import { usePendingLive } from '../hooks/usePendingLive';

type Tab = 'pending' | 'confirmed';

export default function InboxPage() {
  const router = useRouter();
  const { supabase, username, loading: authLoading } = useSupabase();

  const [tab, setTab] = useState<Tab>('pending');
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Live: pushed over a websocket when realtime is available, polled otherwise.
  const {
    transactions,
    loading,
    error: loadError,
    mode,
    refresh,
    setTransactions,
  } = usePendingLive(username, tab);

  const error = actionError || loadError;

  // Per-row overrides, so editing one row's category does not touch the others.
  const [edits, setEdits] = useState<Record<string, { category?: string; accountId?: string | null }>>({});

  useEffect(() => {
    if (authLoading) return;
    if (!username) router.push('/auth');
  }, [username, authLoading, router]);

  useEffect(() => {
    if (!username) return;
    getCategories().then(setCategories).catch(() => {});
    supabase
      .from('accounts')
      .select('id, name, type, last4')
      .eq('username', username)
      .then(({ data }) => setAccounts(data || []));
  }, [username, supabase]);

  const act = async (id: string, action: 'confirm' | 'dismiss' | 'undo') => {
    if (!username) return;
    hapticFeedback('medium');
    setBusyId(id);
    setActionError(null);

    // Optimistic: the row leaves the current list either way.
    const previous = transactions;
    setTransactions((rows) => rows.filter((r) => r.id !== id));

    try {
      const edit = edits[id] || {};
      const res = await fetch('/api/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          id,
          action,
          ...(action === 'confirm'
            ? { category: edit.category, accountId: edit.accountId }
            : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Action failed');
      hapticFeedback('light');
      refresh();
    } catch (e: any) {
      console.error('Inbox action failed:', e);
      setTransactions(previous); // rollback
      setActionError(e.message || 'Something went wrong');
      hapticFeedback('medium');
    } finally {
      setBusyId(null);
    }
  };

  const setEdit = (id: string, patch: { category?: string; accountId?: string | null }) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const accountLabel = (id: string | null) => {
    if (!id) return null;
    const a = accounts.find((x) => x.id === id);
    return a ? a.name : null;
  };

  const formatDate = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        <div className="w-full max-w-md lg:max-w-2xl mx-auto px-4 sm:px-5 md:px-6 pt-4 pb-32 sm:pb-36">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-ios-title-2 text-black dark:text-white">Auto-Tracked</h1>
            <span
              className="flex items-center gap-1.5 text-ios-caption-1 text-black/40 dark:text-white/40"
              title={
                mode === 'live'
                  ? 'Connected — new transactions appear instantly'
                  : mode === 'polling'
                  ? 'Realtime unavailable — checking every 10 seconds'
                  : 'Connecting…'
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  mode === 'live'
                    ? 'bg-green-500'
                    : mode === 'polling'
                    ? 'bg-amber-500'
                    : 'bg-black/20 dark:bg-white/20'
                }`}
              />
              {mode === 'live' ? 'Live' : mode === 'polling' ? 'Checking' : 'Connecting'}
            </span>
          </div>

          <div className="flex gap-2 mb-4">
            {(['pending', 'confirmed'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  hapticFeedback('light');
                  setTab(t);
                }}
                className={`flex-1 py-2 text-ios-caption-1 rounded-ios border transition-colors ${
                  tab === t
                    ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                    : 'bg-white dark:bg-black text-black/60 dark:text-white/60 border-black/20 dark:border-white/20'
                }`}
              >
                {t === 'pending' ? 'Needs review' : 'Added automatically'}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-ios border border-red-600/20 dark:border-red-400/20 bg-red-600/5">
              <p className="text-ios-caption-1 text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {loading && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 rounded-ios bg-black/5 dark:bg-white/5 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && transactions.length === 0 && (
            <div className="text-center py-16">
              <p className="text-ios-body text-black/40 dark:text-white/40">
                {tab === 'pending' ? 'Nothing to review' : 'Nothing added automatically yet'}
              </p>
              <p className="text-ios-caption-1 text-black/30 dark:text-white/30 mt-2">
                {tab === 'pending'
                  ? 'Transactions parsed from SMS that need a second look will appear here.'
                  : 'High-confidence transactions post straight to your expenses.'}
              </p>
            </div>
          )}

          {!loading && transactions.length > 0 && (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const edit = edits[tx.id] || {};
                const category = edit.category ?? tx.suggested_category ?? '';
                const accountId = edit.accountId !== undefined ? edit.accountId : tx.matched_account_id;
                const isCredit = tx.direction === 'credit';
                const confidencePct = Math.round(parseFloat(tx.confidence) * 100);

                return (
                  <div
                    key={tx.id}
                    className={`p-3 bg-white dark:bg-black border rounded-ios ${
                      busyId === tx.id ? 'opacity-50' : ''
                    } border-black/10 dark:border-white/10`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-ios-body text-black dark:text-white truncate">
                            {tx.merchant || 'Unknown merchant'}
                          </span>
                          {isCredit && (
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-600/10 text-green-700 dark:text-green-400">
                              MONEY IN
                            </span>
                          )}
                          {tx.status === 'confirmed' && (
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-black/10 dark:bg-white/10 text-black/60 dark:text-white/60">
                              AUTO
                            </span>
                          )}
                        </div>
                        <p className="text-ios-caption-1 text-black/50 dark:text-white/50 mt-0.5">
                          {formatDate(tx.occurred_on)}
                          {tx.account_last4 ? ` · ····${tx.account_last4}` : ''}
                          {accountLabel(accountId) ? ` · ${accountLabel(accountId)}` : ''}
                          {` · ${confidencePct}% sure`}
                        </p>
                      </div>
                      <span
                        className={`text-ios-headline font-semibold shrink-0 ml-2 ${
                          isCredit ? 'text-green-700 dark:text-green-400' : 'text-black dark:text-white'
                        }`}
                      >
                        {isCredit ? '+' : ''}
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>

                    {tx.status === 'pending' ? (
                      <>
                        <div className="flex gap-2 mb-2">
                          <select
                            value={category}
                            onChange={(e) => setEdit(tx.id, { category: e.target.value })}
                            className="flex-1 min-w-0 px-2 py-2 bg-white dark:bg-black text-ios-caption-1 text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none"
                          >
                            <option value="">Pick a category…</option>
                            {categories.map((c) => (
                              <option key={c.name} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={accountId || ''}
                            onChange={(e) => setEdit(tx.id, { accountId: e.target.value || null })}
                            className="flex-1 min-w-0 px-2 py-2 bg-white dark:bg-black text-ios-caption-1 text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none"
                          >
                            <option value="">No account</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => act(tx.id, 'dismiss')}
                            disabled={busyId === tx.id}
                            className="px-3 py-1.5 text-ios-caption-1 text-black/60 dark:text-white/60 border border-black/20 dark:border-white/20 rounded-ios active:opacity-80 disabled:opacity-50"
                          >
                            Not an expense
                          </button>
                          <button
                            onClick={() => act(tx.id, 'confirm')}
                            disabled={busyId === tx.id || !category}
                            className="flex-1 py-1.5 text-ios-caption-1 bg-black dark:bg-white text-white dark:text-black rounded-ios active:opacity-80 disabled:opacity-50"
                          >
                            {category ? 'Add expense' : 'Pick a category first'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => act(tx.id, 'undo')}
                        disabled={busyId === tx.id}
                        className="w-full py-1.5 text-ios-caption-1 text-red-600 dark:text-red-400 border border-red-600/20 dark:border-red-400/20 rounded-ios active:opacity-80 disabled:opacity-50"
                      >
                        Undo — remove expense and restore balance
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
