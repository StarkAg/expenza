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
    <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black px-3 sm:px-4 md:px-6">
      <div className="w-full max-w-md lg:max-w-lg">

        <div className="space-y-3 sm:space-y-4">
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
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                disabled={loading}
                autoFocus
              />
              <p className="text-ios-caption-2 text-black/50 dark:text-white/50 mt-1 px-1">
                3-20 characters (letters, numbers, underscore)
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="w-full py-3 sm:py-4 bg-black dark:bg-white text-white dark:text-black text-ios-headline font-semibold rounded-ios-lg disabled:opacity-50 disabled:cursor-not-allowed active:opacity-80"
            >
              {loading ? 'Signing in...' : 'Continue'}
            </button>

            {message && (
              <p className="text-ios-caption-1 text-center text-black dark:text-white">
                {message}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

