// Advanced caching utilities for offline support

/**
 * Cache data with expiration
 */
export function setCache<T>(key: string, data: T, ttl: number = 24 * 60 * 60 * 1000): void {
  if (typeof window === 'undefined') return;
  
  const item = {
    data,
    timestamp: Date.now(),
    ttl,
  };
  
  try {
    localStorage.setItem(key, JSON.stringify(item));
  } catch (error) {
    console.error('Error setting cache:', error);
    // If storage is full, clear old cache entries
    clearOldCache();
  }
}

/**
 * Get cached data if not expired
 */
export function getCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    
    const parsed = JSON.parse(item);
    const now = Date.now();
    
    // Check if expired
    if (now - parsed.timestamp > parsed.ttl) {
      localStorage.removeItem(key);
      return null;
    }
    
    return parsed.data as T;
  } catch (error) {
    console.error('Error getting cache:', error);
    return null;
  }
}

/**
 * Clear expired cache entries
 */
function clearOldCache(): void {
  if (typeof window === 'undefined') return;
  
  const keys = Object.keys(localStorage);
  const now = Date.now();
  
  for (const key of keys) {
    if (key.startsWith('cache_')) {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          if (now - parsed.timestamp > parsed.ttl) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        // Remove invalid entries
        localStorage.removeItem(key);
      }
    }
  }
}

/**
 * Prefetch and cache data for offline use
 */
export async function prefetchData<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = 24 * 60 * 60 * 1000
): Promise<T> {
  // Check cache first
  const cached = getCache<T>(key);
  if (cached) {
    // Return cached data immediately, then update in background
    fetchFn()
      .then((data) => setCache(key, data, ttl))
      .catch(() => {
        // Ignore errors in background fetch
      });
    return cached;
  }
  
  // Fetch and cache
  const data = await fetchFn();
  setCache(key, data, ttl);
  return data;
}

/**
 * Cache with stale-while-revalidate strategy
 */
export async function staleWhileRevalidate<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = 24 * 60 * 60 * 1000
): Promise<T> {
  const cached = getCache<T>(key);
  
  // Return stale cache immediately if available
  if (cached) {
    // Update in background
    fetchFn()
      .then((data) => setCache(key, data, ttl))
      .catch(() => {
        // Keep stale data on error
      });
    return cached;
  }
  
  // No cache, fetch fresh
  const data = await fetchFn();
  setCache(key, data, ttl);
  return data;
}

