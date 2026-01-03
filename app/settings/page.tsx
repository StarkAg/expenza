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
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        <div className="max-w-md mx-auto px-4 pt-4 pb-24">
          <h1 className="text-ios-large-title text-black dark:text-white mb-6">
            Settings
          </h1>

          <div className="space-y-4">
            {username && (
              <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg p-4">
                <p className="text-ios-caption-1 text-black/60 dark:text-white/60 mb-1">
                  Signed in as
                </p>
                <p className="text-ios-body text-black dark:text-white">
                  @{username}
                </p>
              </div>
            )}

            <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg overflow-hidden">
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-3 text-left text-ios-body text-black dark:text-white active:bg-black/5 dark:active:bg-white/5"
              >
                Sign Out
              </button>
            </div>

            <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg overflow-hidden">
              <button
                onClick={handleDeleteAccount}
                className="w-full px-4 py-3 text-left text-ios-body text-black dark:text-white active:bg-black/5 dark:active:bg-white/5"
              >
                Delete Account
              </button>
            </div>

            <div className="pt-4">
              <p className="text-ios-caption-1 text-black/50 dark:text-white/50 text-center">
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

