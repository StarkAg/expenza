'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '../../providers';
import BottomNav from '../../components/BottomNav';
import { hapticFeedback } from '../../utils/haptics';

interface DeviceToken {
  id: string;
  label: string;
  platform: 'ios' | 'android' | 'other';
  token_hint: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export default function AutoTrackerSettingsPage() {
  const router = useRouter();
  const { username, loading: authLoading } = useSupabase();

  const [tokens, setTokens] = useState<DeviceToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [platform, setPlatform] = useState<'ios' | 'android'>('ios');
  const [creating, setCreating] = useState(false);

  // Shown exactly once, right after creation -- the server only keeps a hash.
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!username) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/tokens?username=${encodeURIComponent(username)}`);
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load');
      setTokens((await res.json()).tokens || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (authLoading) return;
    if (!username) {
      router.push('/auth');
      return;
    }
    load();
  }, [username, authLoading, router, load]);

  const createToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !label.trim()) return;
    hapticFeedback('medium');
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, label: label.trim(), platform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create');
      setFreshToken(data.token);
      setLabel('');
      setCopied(false);
      load();
      hapticFeedback('light');
    } catch (e: any) {
      setError(e.message);
      hapticFeedback('medium');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    if (!username) return;
    if (!confirm('Revoke this device? It will stop sending transactions immediately.')) return;
    hapticFeedback('medium');
    try {
      const res = await fetch(`/api/tokens?username=${encodeURIComponent(username)}&id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not revoke');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const copyToken = async () => {
    if (!freshToken) return;
    try {
      await navigator.clipboard.writeText(freshToken);
      setCopied(true);
      hapticFeedback('light');
    } catch {
      setError('Could not copy. Select the text and copy it manually.');
    }
  };

  const active = tokens.filter((t) => !t.revoked_at);
  const revoked = tokens.filter((t) => t.revoked_at);

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        <div className="w-full max-w-md lg:max-w-2xl mx-auto px-4 sm:px-5 md:px-6 pt-4 pb-32 sm:pb-36">
          <h1 className="text-ios-title-2 text-black dark:text-white mb-1">Auto-Tracking</h1>
          <p className="text-ios-caption-1 text-black/50 dark:text-white/50 mb-5">
            Pair a phone so bank SMS become expenses automatically.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-ios border border-red-600/20 dark:border-red-400/20 bg-red-600/5">
              <p className="text-ios-caption-1 text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {freshToken && (
            <div className="mb-5 p-3 rounded-ios border-2 border-black dark:border-white">
              <p className="text-ios-caption-1 font-semibold text-black dark:text-white mb-1">
                Copy this now — it is shown only once
              </p>
              <p className="text-ios-caption-1 text-black/50 dark:text-white/50 mb-2">
                Only a hash is stored, so it cannot be shown again. Lost it? Revoke and make a new one.
              </p>
              <code className="block break-all p-2 mb-2 rounded bg-black/5 dark:bg-white/10 text-[11px] text-black dark:text-white">
                {freshToken}
              </code>
              <div className="flex gap-2">
                <button
                  onClick={copyToken}
                  className="flex-1 py-2 text-ios-caption-1 bg-black dark:bg-white text-white dark:text-black rounded-ios active:opacity-80"
                >
                  {copied ? 'Copied' : 'Copy token'}
                </button>
                <button
                  onClick={() => setFreshToken(null)}
                  className="px-3 py-2 text-ios-caption-1 text-black/60 dark:text-white/60 border border-black/20 dark:border-white/20 rounded-ios active:opacity-80"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          <form onSubmit={createToken} className="mb-6 space-y-3">
            <div>
              <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                Add a device
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., My iPhone"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                disabled={creating}
              />
            </div>
            <div className="flex gap-2">
              {(['ios', 'android'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`flex-1 py-2 text-ios-caption-1 rounded-ios border transition-colors ${
                    platform === p
                      ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                      : 'bg-white dark:bg-black text-black/60 dark:text-white/60 border-black/20 dark:border-white/20'
                  }`}
                >
                  {p === 'ios' ? 'iPhone (Shortcut)' : 'Android (app)'}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={creating || !label.trim()}
              className="w-full py-3 bg-black dark:bg-white text-white dark:text-black text-ios-headline font-semibold rounded-ios-lg disabled:opacity-50 active:opacity-80"
            >
              {creating ? 'Creating…' : 'Create token'}
            </button>
          </form>

          <h2 className="text-ios-body font-semibold text-black dark:text-white mb-2">Paired devices</h2>

          {loading && <div className="h-16 rounded-ios bg-black/5 dark:bg-white/5 animate-pulse" />}

          {!loading && active.length === 0 && (
            <p className="text-ios-caption-1 text-black/40 dark:text-white/40 py-4">
              No devices paired yet.
            </p>
          )}

          <div className="space-y-2">
            {active.map((t) => (
              <div
                key={t.id}
                className="flex justify-between items-center p-3 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-ios-body text-black dark:text-white truncate">{t.label}</span>
                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-black/10 dark:bg-white/10 text-black/60 dark:text-white/60">
                      {t.platform === 'ios' ? 'iPhone' : t.platform === 'android' ? 'Android' : 'Other'}
                    </span>
                  </div>
                  <p className="text-ios-caption-1 text-black/50 dark:text-white/50 mt-0.5">
                    ···{t.token_hint} ·{' '}
                    {t.last_used_at
                      ? `last used ${new Date(t.last_used_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
                      : 'never used'}
                  </p>
                </div>
                <button
                  onClick={() => revoke(t.id)}
                  className="px-3 py-1.5 text-ios-caption-1 text-red-600 dark:text-red-400 border border-red-600/20 dark:border-red-400/20 rounded-ios active:opacity-80 shrink-0 ml-2"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>

          {revoked.length > 0 && (
            <p className="text-ios-caption-1 text-black/30 dark:text-white/30 mt-4">
              {revoked.length} revoked device{revoked.length > 1 ? 's' : ''} hidden
            </p>
          )}

          <div className="mt-8 p-3 rounded-ios bg-black/5 dark:bg-white/5">
            <p className="text-ios-caption-1 text-black/60 dark:text-white/60">
              Setup steps for the iPhone Shortcut and the Android app are in{' '}
              <span className="font-semibold">AUTO_TRACKER.md</span> in the project root.
            </p>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
