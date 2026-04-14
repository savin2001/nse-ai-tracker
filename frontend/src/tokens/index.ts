/**
 * Design Tokens — NSE AI Tracker
 * Single source of truth for all design decisions.
 * CSS custom properties in index.css mirror these values.
 */

export const colors = {
  bg: {
    base:     "#000000",
    surface:  "#080808",
    card:     "rgba(255,255,255,0.025)",
    cardHover:"rgba(255,255,255,0.045)",
  },
  border: {
    subtle:  "rgba(255,255,255,0.05)",
    default: "rgba(255,255,255,0.09)",
    hover:   "rgba(255,255,255,0.18)",
  },
  accent: {
    emerald:     "#10b981",
    emeraldDim:  "rgba(16,185,129,0.12)",
    emeraldGlow: "rgba(16,185,129,0.20)",
    purple:      "#8b5cf6",
    purpleDim:   "rgba(139,92,246,0.12)",
    amber:       "#f59e0b",
    red:         "#ef4444",
    blue:        "#3b82f6",
  },
  text: {
    primary:   "#ffffff",
    secondary: "#a1a1aa",
    muted:     "#71717a",
    subtle:    "#3f3f46",
  },
  /** Signal-specific colour triplets */
  signal: {
    BUY:  { text: "#10b981", bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.25)"  },
    HOLD: { text: "#f59e0b", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.25)"  },
    SELL: { text: "#ef4444", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.25)"   },
  } as const,
} as const;

export const typography = {
  fontSans: '"Inter", system-ui, -apple-system, sans-serif',
  fontMono: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
  scale: {
    xs:   "0.75rem",    // 12px
    sm:   "0.875rem",   // 14px
    base: "1rem",       // 16px
    lg:   "1.125rem",   // 18px
    xl:   "1.25rem",    // 20px
    "2xl":"1.5rem",     // 24px
    "3xl":"1.875rem",   // 30px
    "4xl":"2.25rem",    // 36px
    "5xl":"3rem",       // 48px
    "6xl":"3.75rem",    // 60px
  },
} as const;

export const animation = {
  duration: {
    instant: 0.10,
    fast:    0.20,
    normal:  0.35,
    slow:    0.50,
    slower:  0.80,
  },
  spring: {
    snappy: { type: "spring" as const, stiffness: 500, damping: 30 },
    bouncy: { type: "spring" as const, stiffness: 300, damping: 20 },
    smooth: { type: "spring" as const, stiffness: 200, damping: 30 },
  },
  easing: {
    smooth: [0.25, 0.46, 0.45, 0.94] as [number,number,number,number],
    out:    [0.00, 0.00, 0.20, 1.00] as [number,number,number,number],
    sharp:  [0.25, 0.10, 0.25, 1.00] as [number,number,number,number],
  },
  /** Framer Motion stagger variants */
  staggerContainer: {
    hidden: {},
    show: { transition: { staggerChildren: 0.06 } },
  },
  staggerItem: {
    hidden: { opacity: 0, y: 16 },
    show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
  },
} as const;

export const layout = {
  sidebarWidth:  "224px",
  topbarHeight:  "56px",
  maxWidth:      "1280px",
  containerPadX: { sm: "16px", md: "24px", lg: "32px" },
} as const;

export const elevation = {
  card:    "0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4)",
  raised:  "0 4px 24px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.5)",
  modal:   "0 20px 60px rgba(0,0,0,0.8), 0 4px 20px rgba(0,0,0,0.5)",
  emerald: "0 0 24px rgba(16,185,129,0.18), 0 0 60px rgba(16,185,129,0.06)",
  red:     "0 0 24px rgba(239,68,68,0.18),  0 0 60px rgba(239,68,68,0.06)",
  purple:  "0 0 24px rgba(139,92,246,0.18), 0 0 60px rgba(139,92,246,0.06)",
} as const;
