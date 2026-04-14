import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

/** Counts up from 0 to `value` with an ease-out cubic curve. */
export default function AnimatedNumber({
  value,
  duration = 1400,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
}: Props) {
  const [displayed, setDisplayed] = useState(0);
  const startTs  = useRef<number | null>(null);
  const fromVal  = useRef(0);
  const rafId    = useRef<number | null>(null);

  useEffect(() => {
    const from = fromVal.current;
    const to   = value;
    startTs.current = null;

    function tick(ts: number) {
      if (!startTs.current) startTs.current = ts;
      const t = Math.min((ts - startTs.current) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setDisplayed(from + (to - from) * eased);
      if (t < 1) {
        rafId.current = requestAnimationFrame(tick);
      } else {
        fromVal.current = to;
      }
    }
    rafId.current = requestAnimationFrame(tick);
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}{displayed.toFixed(decimals)}{suffix}
    </span>
  );
}
