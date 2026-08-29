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

type CopyTarget = 'shortcut';

// Shortcuts run on the iPhone, not on the computer that created the device.
// This must remain a public production origin even while the web UI is being
// tested through localhost.
const PUBLIC_APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'https://expenza-expense-tracker-6kjh69gl2-starkags-projects.vercel.app';

export default function AutoTrackerSettingsPage() {
  const router = useRouter();
  const { username, loading: authLoading } = useSupabase();

  const [tokens, setTokens] = useState<DeviceToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);

  // One reusable link belongs to the account, not to a particular phone.
  const [connectionToken, setConnectionToken] = useState<string | null>(null);
  const [copied, setCopied] = useState<CopyTarget | null>(null);

  const load = useCallback(async () => {
    if (!username) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/tokens?username=${encodeURIComponent(username)}`);
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load');
      const data = await res.json();
      setTokens(data.tokens || []);
      setConnectionToken(data.connectionToken || null);
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
    if (!username) return;
    hapticFeedback('medium');
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create');
      setConnectionToken(data.token);
      setCopied(null);
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
    if (!confirm('Revoke this Auto-Tracking link? It will stop sending transactions immediately.')) return;
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

  const copyText = async (text: string, target: CopyTarget) => {
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const fallback = document.createElement('textarea');
        fallback.value = text;
        fallback.setAttribute('readonly', '');
        fallback.style.position = 'fixed';
        fallback.style.opacity = '0';
        document.body.appendChild(fallback);
        fallback.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(fallback);
        if (!copied) throw new Error('Copy command was rejected');
      }
      setCopied(target);
      hapticFeedback('light');
    } catch {
      setError('Could not copy. Select the text and copy it manually.');
    }
  };

  const active = tokens.filter((t) => !t.revoked_at);
  const revoked = tokens.filter((t) => t.revoked_at);
  const shortcutUrl = connectionToken
    ? `${PUBLIC_APP_ORIGIN}/api/ingest?token=${encodeURIComponent(connectionToken)}`
    : '';

  return (
    <div className="auto-tracker-screen flex flex-col h-screen bg-white dark:bg-black">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        <div className="w-full max-w-md lg:max-w-2xl mx-auto px-4 sm:px-5 md:px-6 pt-4 pb-32 sm:pb-36">
          <h1 className="text-ios-title-2 text-black dark:text-white mb-1">Auto-Tracking</h1>
          <p className="text-ios-caption-1 text-black/50 dark:text-white/50 mb-5">
            Pair a phone so bank SMS become expenses automatically.
          </p>
          <button
            type="button"
            onClick={() => {
              hapticFeedback('light');
              router.push('/settings/auto-tracker/iphone-guide');
            }}
            className="auto-tracker-guide-link w-full mb-5 px-3 py-3 rounded-ios text-left"
          >
            <span className="auto-tracker-guide-link__eyebrow">New to Shortcuts?</span>
            <span className="auto-tracker-guide-link__title">Set up iPhone Auto-Tracking</span>
            <span className="auto-tracker-guide-link__arrow" aria-hidden="true">→</span>
          </button>

          {error && (
            <div className="mb-4 p-3 rounded-ios border border-red-600/20 dark:border-red-400/20 bg-red-600/5">
              <p className="text-ios-caption-1 text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {connectionToken && (
            <section className="auto-tracker-setup mb-5 p-4 rounded-ios-lg">
              <p className="text-ios-caption-1 font-semibold text-black dark:text-white mb-1">
                Your Auto-Tracking link
              </p>
              <p className="text-ios-caption-1 text-black/50 dark:text-white/50 mb-2">
                This is your one link for the account. Use the same URL on iPhone, Mac, or any supported sender.
              </p>

              <span className="auto-tracker-setup__label">Shortcut URL</span>
              <code tabIndex={0} className="auto-tracker-setup__code block break-all p-3 mb-2 rounded text-[11px]">
                {shortcutUrl || 'Preparing your shortcut URL…'}
              </code>
              <button
                type="button"
                disabled={!shortcutUrl}
                onClick={() => copyText(shortcutUrl, 'shortcut')}
                className="auto-tracker-setup__primary w-full py-2.5 text-ios-caption-1 rounded-ios active:opacity-80"
              >
                {copied === 'shortcut' ? 'Shortcut URL copied' : 'Copy shortcut URL'}
              </button>

            </section>
          )}

          <form onSubmit={createToken} className="mb-6">
            <button
              type="submit"
              disabled={creating}
              className="w-full py-3 bg-black dark:bg-white text-white dark:text-black text-ios-headline font-semibold rounded-ios-lg disabled:opacity-50 active:opacity-80"
            >
              {creating ? 'Preparing…' : connectionToken ? 'Show my Auto-Tracking link' : 'Create Auto-Tracking link'}
            </button>
          </form>

          <h2 className="text-ios-body font-semibold text-black dark:text-white mb-2">Account connection</h2>

          {loading && <div className="h-16 rounded-ios bg-black/5 dark:bg-white/5 animate-pulse" />}

          {!loading && active.length === 0 && (
            <p className="text-ios-caption-1 text-black/40 dark:text-white/40 py-4">
              No Auto-Tracking link created yet.
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
                      Account-wide
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
                  Revoke link
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
              Create a device connection to get a full, copyable endpoint and the setup steps here. You never need to open a project file from your phone.
            </p>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
