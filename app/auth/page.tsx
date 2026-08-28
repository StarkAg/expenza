'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { hapticFeedback } from '../utils/haptics';

export default function AuthPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Check if user is already logged in
    if (typeof window !== 'undefined') {
      const storedUsername = localStorage.getItem('username');
      if (storedUsername) {
        router.push('/');
      }
    }
  }, [router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setMessage('Please enter a username');
      return;
    }

    // Validate username (alphanumeric, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username.trim())) {
      setMessage('Username must be 3-20 characters (letters, numbers, underscore only)');
      return;
    }

    hapticFeedback('medium');
    setLoading(true);
    setMessage('');

    try {
      // Just store username in localStorage
      const cleanUsername = username.trim().toLowerCase();
      if (typeof window !== 'undefined') {
        localStorage.setItem('username', cleanUsername);
        // Dispatch custom event to notify Providers component
        window.dispatchEvent(new CustomEvent('username-updated'));
      }
      
      // Wait a tick to ensure context updates before redirect
      hapticFeedback('light');
      await new Promise(resolve => setTimeout(resolve, 150));
      router.push('/stats');
    } catch (error: any) {
      console.error('Sign in error:', error);
      setMessage('Failed to sign in. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen flex items-center justify-center min-h-screen px-3 sm:px-4 md:px-6">
      <div className="w-full max-w-md lg:max-w-lg">
        <div className="auth-brand text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element -- static PWA mark is already a 192px local asset */}
          <img className="auth-brand__logo" src="/icon-192.png" alt="Expenza" />
          <p className="auth-brand__eyebrow">PERSONAL FINANCE, SIMPLIFIED</p>
          <h1 className="auth-brand__title">Know where every rupee goes.</h1>
          <p className="auth-brand__copy">Keep your spending, accounts, and monthly bills in one calm place.</p>
        </div>
        <div className="auth-card space-y-3 sm:space-y-4">
          <form onSubmit={handleSignIn} className="space-y-3 sm:space-y-4">
            <div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                minLength={3}
                maxLength={20}
                pattern="[a-zA-Z0-9_]{3,20}"
                className="auth-input w-full px-3 sm:px-4 py-2.5 sm:py-3 text-ios-body rounded-ios focus:outline-none"
                disabled={loading}
                autoFocus
              />
              <p className="auth-input-hint text-ios-caption-2 mt-1 px-1">
                3-20 characters (letters, numbers, underscore)
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="auth-submit w-full py-3 sm:py-4 text-ios-headline font-semibold rounded-ios-lg disabled:cursor-not-allowed active:opacity-80"
            >
              {loading ? 'Signing in...' : 'Continue'}
            </button>

            {message && (
              <p className="auth-message text-ios-caption-1 text-center">
                {message}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
