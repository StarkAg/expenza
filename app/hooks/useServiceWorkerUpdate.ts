'use client';

import { useEffect } from 'react';

export function useServiceWorkerUpdate() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let registration: ServiceWorkerRegistration | undefined;
    let updateCheckInterval: NodeJS.Timeout | null = null;

    // Check for updates
    const checkForUpdates = async () => {
      try {
        if (registration) {
          await registration.update();
        } else {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            registration = reg;
            await registration.update();
          }
        }
      } catch (error) {
        console.error('Error checking for service worker updates:', error);
      }
    };

    // Handle service worker update found
    const handleUpdateFound = () => {
      const installingWorker = registration?.installing || registration?.waiting;
      
      if (installingWorker && navigator.serviceWorker.controller) {
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed') {
            // New service worker is waiting - tell it to skip waiting and activate
            installingWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      }
    };

    // Initialize service worker update checking
    const initServiceWorkerUpdate = async () => {
      try {
        // Wait for service worker to be ready
        registration = await navigator.serviceWorker.ready;
        
        // Listen for updates
        registration.addEventListener('updatefound', handleUpdateFound);
        
        // Check for updates immediately
        checkForUpdates();
        
        // Check for updates periodically (every 60 seconds)
        updateCheckInterval = setInterval(checkForUpdates, 60000);
        
        // Also check when the page becomes visible (user returns to the app)
        const handleVisibilityChange = () => {
          if (!document.hidden) {
            checkForUpdates();
          }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Cleanup function
        return () => {
          if (updateCheckInterval) {
            clearInterval(updateCheckInterval);
          }
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          registration?.removeEventListener('updatefound', handleUpdateFound);
        };
      } catch (error) {
        console.error('Error initializing service worker update:', error);
      }
    };

    // Listen for controller changes (when a new service worker takes control)
    const handleControllerChange = () => {
      // Reload the page when a new service worker takes control
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Initialize
    initServiceWorkerUpdate();

    // Cleanup on unmount
    return () => {
      if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
      }
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);
}
