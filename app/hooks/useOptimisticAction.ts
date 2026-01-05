'use client';

import { useTransition, useState, useCallback } from 'react';

/**
 * Hook for optimistic UI updates with instant feedback
 * Makes buttons feel lag-free like a native app
 */
export function useOptimisticAction<T extends any[]>(
  action: (...args: T) => Promise<void>,
  onSuccess?: () => void,
  onError?: (error: Error) => void
) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (...args: T) => {
      setError(null);
      
      // Use transition for non-blocking UI updates
      startTransition(async () => {
        try {
          // Use requestIdleCallback for smooth execution
          await new Promise<void>((resolve) => {
            if ('requestIdleCallback' in window) {
              requestIdleCallback(() => {
                action(...args).then(resolve).catch((err) => {
                  setError(err);
                  onError?.(err);
                  resolve();
                });
              });
            } else {
              // Fallback for browsers without requestIdleCallback
              setTimeout(() => {
                action(...args).then(resolve).catch((err) => {
                  setError(err);
                  onError?.(err);
                  resolve();
                });
              }, 0);
            }
          });
          
          if (!error) {
            onSuccess?.();
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          onError?.(error);
        }
      });
    },
    [action, onSuccess, onError, error]
  );

  return { execute, isPending, error };
}

