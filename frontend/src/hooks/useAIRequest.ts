/**
 * useAIRequest — safe wrapper for any function that triggers a Claude call.
 *
 * Features:
 *   - Prevents duplicate concurrent calls (deduplication)
 *   - Debounces rapid repeated invocations (default 800 ms)
 *   - Exposes loading / error / data state
 *   - Cancels stale responses if a newer call lands first
 */
import { useState, useRef, useCallback } from "react";

interface UseAIRequestOptions {
  debounceMs?: number;   // minimum ms between successive calls (default 800)
}

interface UseAIRequestReturn<T> {
  data:    T | null;
  loading: boolean;
  error:   string | null;
  invoke:  () => void;
  reset:   () => void;
}

export function useAIRequest<T>(
  fn: () => Promise<T>,
  options: UseAIRequestOptions = {},
): UseAIRequestReturn<T> {
  const { debounceMs = 800 } = options;

  const [data,    setData]    = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const inFlight    = useRef(false);
  const lastCallAt  = useRef(0);
  const callId      = useRef(0);   // increments on each call; stale responses ignored

  const invoke = useCallback(() => {
    const now = Date.now();

    // Debounce — reject calls that arrive too soon after the last one
    if (now - lastCallAt.current < debounceMs) return;

    // Dedup — reject if already awaiting a response
    if (inFlight.current) return;

    lastCallAt.current = now;
    inFlight.current   = true;
    const myId = ++callId.current;

    setLoading(true);
    setError(null);

    fn()
      .then(result => {
        if (callId.current !== myId) return;  // stale — discard
        setData(result);
      })
      .catch((err: unknown) => {
        if (callId.current !== myId) return;
        const msg = err instanceof Error ? err.message : "AI request failed";
        setError(msg);
      })
      .finally(() => {
        if (callId.current !== myId) return;
        setLoading(false);
        inFlight.current = false;
      });
  }, [fn, debounceMs]);

  const reset = useCallback(() => {
    callId.current++;           // invalidate any in-flight response
    inFlight.current = false;
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, invoke, reset };
}
