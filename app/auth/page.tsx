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
      }
      
      // Success - redirect to home
      hapticFeedback('light');
      router.push('/');
    } catch (error: any) {
      console.error('Sign in error:', error);
      setMessage('Failed to sign in. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-ios-gray-50 dark:bg-ios-gray-900 px-4">
      <div className="w-full max-w-md">
        <h1 className="text-ios-large-title text-ios-gray-900 dark:text-ios-gray-50 mb-2 text-center">
          Expenza
        </h1>
        <p className="text-ios-body text-ios-gray-600 dark:text-ios-gray-400 mb-8 text-center">
          Track your expenses effortlessly
        </p>

        <div className="space-y-4">
          <form onSubmit={handleSignIn} className="space-y-4">
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
                className="w-full px-4 py-3 bg-white dark:bg-ios-gray-800 text-ios-body text-ios-gray-900 dark:text-ios-gray-50 rounded-ios border border-ios-gray-200 dark:border-ios-gray-700 focus:outline-none focus:ring-2 focus:ring-ios-blue"
                disabled={loading}
                autoFocus
              />
              <p className="text-ios-caption-2 text-ios-gray-500 dark:text-ios-gray-500 mt-1 px-1">
                3-20 characters (letters, numbers, underscore)
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="w-full py-4 bg-ios-blue text-white text-ios-headline font-semibold rounded-ios-lg disabled:opacity-50 disabled:cursor-not-allowed active:opacity-80"
            >
              {loading ? 'Signing in...' : 'Continue'}
            </button>

            {message && (
              <p className="text-ios-caption-1 text-center text-ios-red">
                {message}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

