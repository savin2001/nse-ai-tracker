import { useState } from "react";
import { Link } from "react-router-dom";
import {
  motion,
  useMotionValue,
  useTransform,
  useSpring,
} from "motion/react";
import {
  TrendingUp, Brain, BarChart3, Shield, ArrowRight,
  Zap, Sparkles, Activity, ChevronRight,
} from "lucide-react";
import GradientBackground from "../components/ui/GradientBackground";
import AnimatedNumber from "../components/ui/AnimatedNumber";

const MOCK_SIGNALS = [
  { ticker: "SCOM", signal: "BUY",  confidence: 78, change: +2.4 },
  { ticker: "EQTY", signal: "HOLD", confidence: 62, change: -0.8 },
  { ticker: "KCB",  signal: "BUY",  confidence: 85, change: +1.9 },
  { ticker: "BRIT", signal: "SELL", confidence: 71, change: -3.1 },
];

const SIGNAL_STYLE: Record<string, string> = {
  BUY:  "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  HOLD: "text-amber-400  bg-amber-500/15  border-amber-500/30",
  SELL: "text-red-400    bg-red-500/15    border-red-500/30",
};

const FEATURES = [
  {
    icon: Brain,
    title: "AI-Powered Signals",
    desc: "Claude analyses technical, fundamental, and sentiment data to generate BUY/HOLD/SELL signals for every NSE equity.",
    iconBg: "bg-purple-500/15", iconColor: "text-purple-400",
    border: "border-purple-500/15", gradient: "from-purple-500/8 to-blue-500/8",
  },
  {
    icon: BarChart3,
    title: "Real-Time Market Data",
    desc: "Live OHLCV prices, SMA, RSI, MACD, and Bollinger Bands — updated throughout the NSE trading day.",
    iconBg: "bg-emerald-500/15", iconColor: "text-emerald-400",
    border: "border-emerald-500/15", gradient: "from-emerald-500/8 to-teal-500/8",
  },
  {
    icon: Zap,
    title: "Event Detection",
    desc: "Automatic classification of earnings, dividends, regulatory actions, price spikes, and volume surges.",
    iconBg: "bg-amber-500/15", iconColor: "text-amber-400",
    border: "border-amber-500/15", gradient: "from-amber-500/8 to-orange-500/8",
  },
  {
    icon: Shield,
    title: "Portfolio Engine",
    desc: "Smart rebalancing recommendations that align your allocations with AI signals and your risk tolerance.",
    iconBg: "bg-blue-500/15", iconColor: "text-blue-400",
    border: "border-blue-500/15", gradient: "from-blue-500/8 to-cyan-500/8",
  },
] as const;

const STATS = [
  { value: 20,  suffix: "",  label: "NSE-Listed Companies" },
  { value: 5,   suffix: "",  label: "Market Sectors" },
  { value: 60,  suffix: "+", label: "Daily AI Signals" },
  { value: 365, suffix: "d", label: "Historical Data" },
];

function SignalPill({ signal }: { signal: string }) {
  return (
    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${SIGNAL_STYLE[signal] ?? ""}`}>
      {signal}
    </span>
  );
}

function HeroCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.55, duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative w-full max-w-[320px] animate-float"
    >
      <div className="absolute -inset-4 rounded-3xl bg-emerald-500/8 blur-3xl" />
      <div className="relative rounded-2xl border border-white/10 glass shadow-2xl p-5">
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent rounded-full" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Activity size={11} className="text-emerald-400" />
            </div>
            <span className="text-xs font-semibold text-white">AI Signals</span>
            <span className="text-[10px] font-mono text-gray-600">· Claude</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-mono text-gray-400">Live</span>
          </div>
        </div>
        <div className="space-y-0">
          {MOCK_SIGNALS.map((s, i) => (
            <motion.div
              key={s.ticker}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.75 + i * 0.09 }}
              className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-white w-10">{s.ticker}</span>
                <SignalPill signal={s.signal} />
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs font-bold text-white tabular-nums">{s.confidence}%</div>
                  <div className="text-[9px] text-gray-600">conf</div>
                </div>
                <span className={`text-[10px] font-mono font-semibold tabular-nums ${s.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {s.change >= 0 ? "+" : ""}{s.change.toFixed(1)}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-1.5">
          <Sparkles size={9} className="text-purple-400" />
          <span className="text-[9px] font-mono text-gray-600">Updated daily · 18:00 EAT</span>
        </div>
      </div>
    </motion.div>
  );
}

function FeatureCard({ feature, index }: { feature: typeof FEATURES[number]; index: number }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sRotX = useSpring(useTransform(my, [-60, 60], [6, -6]), { stiffness: 200, damping: 25 });
  const sRotY = useSpring(useTransform(mx, [-60, 60], [-6, 6]), { stiffness: 200, damping: 25 });

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{ perspective: 900, rotateX: sRotX, rotateY: sRotY }}
      onMouseMove={e => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(e.clientX - r.left - r.width / 2);
        my.set(e.clientY - r.top - r.height / 2);
      }}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
      className={`p-6 rounded-2xl border ${feature.border} bg-gradient-to-br ${feature.gradient} hover:shadow-2xl transition-shadow duration-300 cursor-default select-none`}
    >
      <div className={`w-10 h-10 rounded-xl ${feature.iconBg} border ${feature.border} flex items-center justify-center mb-4`}>
        <feature.icon size={17} className={feature.iconColor} />
      </div>
      <h3 className="font-semibold text-white text-sm mb-2">{feature.title}</h3>
      <p className="text-xs text-gray-400 leading-relaxed">{feature.desc}</p>
    </motion.div>
  );
}

export default function LandingPage() {
  const [statsReady, setStatsReady] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <GradientBackground />

      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-4 border-b border-white/5 glass-light"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <TrendingUp size={13} className="text-emerald-400" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-white tracking-tight text-sm">NSE AI Tracker</span>
        </div>
        <div className="flex items-center gap-5">
          <a href="https://github.com/savin2001/nse-ai-tracker" target="_blank" rel="noreferrer"
            className="hidden sm:block text-sm text-gray-500 hover:text-white transition-colors">
            GitHub
          </a>
          <Link to="/login"
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black transition-all shadow-lg shadow-emerald-500/20">
            Sign in <ArrowRight size={13} />
          </Link>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pt-20 pb-16">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/8 text-emerald-400 text-xs font-medium mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Nairobi Securities Exchange · AI-Enhanced
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-[3.2rem] lg:text-[3.8rem] font-bold tracking-tight leading-[1.04] mb-6">
              <span className="text-gradient">Smarter NSE</span><br />
              <span className="text-gradient">Investing</span>{" "}
              <span className="text-gradient-emerald">with AI</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32, duration: 0.5 }}
              className="text-[0.95rem] text-gray-400 leading-relaxed mb-10 max-w-lg">
              Track 20 NSE-listed companies with AI-generated signals, real-time price data,
              automatic event detection, and intelligent portfolio rebalancing.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42, duration: 0.5 }}
              className="flex items-center gap-3">
              <Link to="/login"
                className="group flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all shadow-lg shadow-emerald-500/25 hover:-translate-y-px">
                Get started
                <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a href="https://github.com/savin2001/nse-ai-tracker" target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 hover:border-white/20 text-gray-300 hover:text-white font-medium text-sm transition-all hover:-translate-y-px">
                View source
              </a>
            </motion.div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <HeroCard />
          </div>
        </div>
      </section>

      {/* Stats */}
      <motion.section className="relative z-10 border-y border-white/5 glass-light"
        onViewportEnter={() => setStatsReady(true)}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-7">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-6">
            {STATS.map((s, i) => (
              <motion.div key={s.label}
                initial={{ opacity: 0, y: 8 }}
                animate={statsReady ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="text-center lg:text-left">
                <div className="text-3xl font-bold text-white tabular-nums">
                  {statsReady
                    ? <AnimatedNumber value={s.value} suffix={s.suffix} duration={1200} />
                    : `0${s.suffix}`}
                </div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Features */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 py-24">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}
          className="text-center mb-14">
          <div className="inline-flex items-center gap-3 text-xs font-mono text-gray-600 uppercase tracking-widest mb-5">
            <span className="w-8 h-px bg-gray-700" />Platform Features<span className="w-8 h-px bg-gray-700" />
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gradient mb-4">
            Everything you need to invest smarter
          </h2>
          <p className="text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">
            Built for the Kenyan market — KES/USD rates, CBK policy, and commodity prices all factored in.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f, i) => <FeatureCard key={f.title} feature={f} index={i} />)}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pb-24">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}
          className="relative rounded-3xl border border-white/8 overflow-hidden p-12 text-center">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-purple-500/5" />
          <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 0%, rgba(16,185,129,0.07) 0%, transparent 60%)" }} />
          <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-6">
              <TrendingUp size={22} className="text-emerald-400" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-gradient mb-3">Ready to trade smarter?</h2>
            <p className="text-sm text-gray-500 mb-8 max-w-sm mx-auto leading-relaxed">
              AI-powered signals for all 20 NSE equities, updated daily after market close.
            </p>
            <Link to="/login"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all shadow-lg shadow-emerald-500/25 hover:-translate-y-px">
              Get started <ArrowRight size={14} />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 px-6 lg:px-12 py-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={13} className="text-emerald-400" />
            <span className="text-xs font-semibold text-gray-400">NSE AI Tracker</span>
          </div>
          <p className="text-xs text-gray-600">Built with React 19 · Vite 6 · Claude AI · Not financial advice</p>
        </div>
      </footer>
    </div>
  );
}
