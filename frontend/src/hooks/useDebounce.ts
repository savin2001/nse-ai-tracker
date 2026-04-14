import { useState, useEffect } from "react";

/**
 * Returns a debounced copy of `value` that only updates after `delayMs`
 * of silence. Use to prevent hammering AI endpoints on every keystroke.
 */
export function useDebounce<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
