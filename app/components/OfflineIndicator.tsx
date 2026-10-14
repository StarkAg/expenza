'use client';

import { useOfflineSync } from '../hooks/useOfflineSync';
import { OfflineIcon, SyncIcon } from './Icons';

export default function OfflineIndicator() {
  const { isOnline, pendingSync } = useOfflineSync();

  if (isOnline && !pendingSync) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <div
        className={`w-full max-w-md lg:max-w-2xl mx-auto px-3 sm:px-4 py-2 rounded-ios text-center text-ios-caption-1 flex items-center justify-center gap-2 ${
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

