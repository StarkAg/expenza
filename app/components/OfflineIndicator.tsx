'use client';

import { useOfflineSync } from '../hooks/useOfflineSync';

export default function OfflineIndicator() {
  const { isOnline, pendingSync } = useOfflineSync();

  if (isOnline && !pendingSync) return null;

  return (
    <div className="fixed top-safe-top left-0 right-0 z-50 px-4 pt-safe-top pb-2">
      <div
        className={`max-w-md mx-auto px-4 py-2 rounded-ios text-center text-ios-caption-1 ${
          !isOnline
            ? 'bg-ios-orange text-white'
            : pendingSync
            ? 'bg-ios-blue text-white'
            : ''
        }`}
      >
        {!isOnline ? (
          <span>📴 Offline - Changes will sync when online</span>
        ) : pendingSync ? (
          <span>🔄 Syncing...</span>
        ) : null}
      </div>
    </div>
  );
}

