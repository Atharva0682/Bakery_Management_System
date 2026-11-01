import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Visibility-aware polling hook
 * - Polls `fetcher` every `intervalMs` (default 15s)
 * - Automatically pauses polling when the browser tab is hidden
 * - Resumes immediately with fresh fetch when the tab becomes visible
 * - Retains existing `data` if a subsequent request fails (glitch resilience)
 * - Provides `lastUpdated` timestamp and human-readable `lastUpdatedLabel`
 */
export function usePolling(fetcher, intervalMs = 15000, enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const timerRef = useRef(null);

  const executeFetch = useCallback(async (isInitial = false) => {
    if (!fetcherRef.current) return;
    try {
      if (isInitial) setLoading(true);
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
      setLastUpdated(new Date());
      setSecondsAgo(0);
    } catch (err) {
      console.warn('[usePolling] Fetch error (retaining existing data):', err.message);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    executeFetch(true);

    const startTimer = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (!document.hidden) {
          executeFetch(false);
        }
      }, intervalMs);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        // Tab became visible again: immediate sync & restart polling
        executeFetch(false);
        startTimer();
      }
    };

    startTimer();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs, enabled, executeFetch]);

  // Second-by-second ticker for "Updated Xs ago"
  useEffect(() => {
    const ticker = setInterval(() => {
      if (lastUpdated) {
        const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
        setSecondsAgo(diff);
      }
    }, 2000);
    return () => clearInterval(ticker);
  }, [lastUpdated]);

  const lastUpdatedLabel = lastUpdated
    ? secondsAgo < 5
      ? 'Just now'
      : secondsAgo < 60
      ? `${secondsAgo}s ago`
      : `${Math.floor(secondsAgo / 60)}m ago`
    : 'Connecting...';

  return {
    data,
    loading,
    error,
    lastUpdated,
    lastUpdatedLabel,
    refresh: () => executeFetch(false)
  };
}

export default usePolling;
