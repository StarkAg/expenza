'use client';

import { useEffect } from 'react';

/** One reload per page lifetime, no matter how the events interleave. */
let reloading = false;

const UPDATE_CHECK_MS = 30 * 60 * 1000;

/**
 * Activates a new service worker and reloads once so the fresh build takes
 * over.
 *
 * The guards matter more than the happy path here. The previous version
 * reloaded on every `controllerchange`, including the one `clients.claim()`
 * fires on a first-ever install when there was no controller to replace --
 * a guaranteed reload on first launch, and a reload loop whenever the worker
 * re-activated. Now a reload happens only when a worker that was actually
 * controlling this page is replaced by a newer one.
 */
export function useServiceWorkerUpdate() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Captured before anything can change it. If the page loaded without a
    // controller, the first controllerchange is this app's initial install
    // and there is nothing to reload for.
    const hadControllerAtLoad = Boolean(navigator.serviceWorker.controller);

    let registration: ServiceWorkerRegistration | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    const promote = (worker: ServiceWorker | null) => {
      if (!worker || !hadControllerAtLoad) return;
      if (worker.state === 'installed') {
        worker.postMessage({ type: 'SKIP_WAITING' });
        return;
      }
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') {
          worker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    };

    const handleUpdateFound = () => {
      promote(registration?.installing ?? registration?.waiting ?? null);
    };

    const handleControllerChange = () => {
      if (reloading || !hadControllerAtLoad) return;
      reloading = true;
      window.location.reload();
    };

    const checkForUpdates = () => {
      registration?.update().catch(() => {
        /* offline or throttled by the browser; the next tick retries */
      });
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) checkForUpdates();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    navigator.serviceWorker.ready
      .then((reg) => {
        if (cancelled) return;
        registration = reg;

        // A worker may already be waiting from a previous session.
        promote(reg.waiting);

        reg.addEventListener('updatefound', handleUpdateFound);
        checkForUpdates();
        interval = setInterval(checkForUpdates, UPDATE_CHECK_MS);
        document.addEventListener('visibilitychange', handleVisibilityChange);
      })
      .catch(() => {
        /* no service worker available; the app works without one */
      });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      registration?.removeEventListener('updatefound', handleUpdateFound);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);
}
