'use client';

import { useRouter } from 'next/navigation';
import { useSupabase } from '../providers';
import BottomNav from '../components/BottomNav';
import { hapticFeedback } from '../utils/haptics';

export default function SettingsPage() {
  const router = useRouter();
  const { supabase, username } = useSupabase();

  const handleSignOut = async () => {
    hapticFeedback('medium');
    localStorage.removeItem('username');
    router.push('/auth');
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This cannot be undone.')) {
      return;
    }

    hapticFeedback('heavy');
    // Delete all expenses first
    if (username) {
      await supabase.from('expenses').delete().eq('username', username);
      localStorage.removeItem('username');
      localStorage.removeItem(`expenses_${username}`);
      router.push('/auth');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-ios-gray-50 dark:bg-ios-gray-900">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        <div className="max-w-md mx-auto px-4 pt-4 pb-24">
          <h1 className="text-ios-large-title text-ios-gray-900 dark:text-ios-gray-50 mb-6">
            Settings
          </h1>

          <div className="space-y-4">
            {username && (
              <div className="bg-white dark:bg-ios-gray-800 rounded-ios-lg p-4 shadow-ios">
                <p className="text-ios-caption-1 text-ios-gray-600 dark:text-ios-gray-400 mb-1">
                  Signed in as
                </p>
                <p className="text-ios-body text-ios-gray-900 dark:text-ios-gray-50">
                  @{username}
                </p>
              </div>
            )}

            <div className="bg-white dark:bg-ios-gray-800 rounded-ios-lg overflow-hidden shadow-ios">
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-3 text-left text-ios-body text-ios-red active:bg-ios-gray-100 dark:active:bg-ios-gray-700"
              >
                Sign Out
              </button>
            </div>

            <div className="bg-white dark:bg-ios-gray-800 rounded-ios-lg overflow-hidden shadow-ios">
              <button
                onClick={handleDeleteAccount}
                className="w-full px-4 py-3 text-left text-ios-body text-ios-red active:bg-ios-gray-100 dark:active:bg-ios-gray-700"
              >
                Delete Account
              </button>
            </div>

            <div className="pt-4">
              <p className="text-ios-caption-1 text-ios-gray-500 dark:text-ios-gray-500 text-center">
                Expenza v1.0.0
              </p>
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

