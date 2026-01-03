'use client';

import { useOfflineSync } from '../hooks/useOfflineSync';
import { OfflineIcon, SyncIcon } from './Icons';

export default function OfflineIndicator() {
  const { isOnline, pendingSync } = useOfflineSync();

  if (isOnline && !pendingSync) return null;

  return (
    <div className="fixed top-safe-top left-0 right-0 z-50 px-4 pt-safe-top pb-2">
      <div
        className={`max-w-md mx-auto px-4 py-2 rounded-ios text-center text-ios-caption-1 flex items-center justify-center gap-2 ${
          !isOnline
            ? 'bg-black dark:bg-white text-white dark:text-black'
            : pendingSync
            ? 'bg-black dark:bg-white text-white dark:text-black'
            : ''
        }`}
      >
        {!isOnline ? (
          <>
            <OfflineIcon size={14} />
            <span>Offline - Changes will sync when online</span>
          </>
        ) : pendingSync ? (
          <>
            <SyncIcon size={14} className="animate-spin" />
            <span>Syncing...</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

