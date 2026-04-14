import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { TrendingUp, Brain, BarChart3, Shield, ArrowRight, Zap } from "lucide-react";

const features = [
  { icon: Brain,    title: "AI-Powered Signals",    desc: "Claude analyses technical, fundamental, and sentiment data to generate BUY/HOLD/SELL signals for every NSE stock." },
  { icon: BarChart3, title: "Real-Time Market Data", desc: "Live OHLCV prices, moving averages, RSI, MACD, and Bollinger Bands updated throughout the trading day." },
  { icon: Zap,      title: "Event Detection",        desc: "Automatic detection of earnings releases, dividend announcements, regulatory actions, price spikes, and volume surges." },
  { icon: Shield,   title: "Portfolio Engine",        desc: "Smart rebalancing recommendations that align your allocations with AI signals and your risk tolerance." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" strokeWidth={2.5} />
          <span className="font-bold text-white">NSE AI Tracker</span>
        </div>
        <Link
          to="/login"
          className="flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
        >
          Sign in <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Nairobi Securities Exchange · AI-Enhanced
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">
            Smarter NSE<br />Investing with AI
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Track all 20 NSE-listed companies with AI-generated signals, real-time price data,
            automatic event detection, and intelligent portfolio rebalancing — all in one platform.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              to="/login"
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-colors flex items-center gap-2"
            >
              Get started <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="https://github.com/savin2001/nse-ai-tracker"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 rounded-xl border border-white/10 hover:border-white/20 text-gray-300 hover:text-white font-medium text-sm transition-colors"
            >
              View on GitHub
            </a>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="p-6 rounded-2xl bg-white/3 border border-white/8 hover:border-emerald-500/20 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
                <Icon className="w-4.5 h-4.5 text-emerald-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-6 text-center text-xs text-gray-600">
        NSE AI Tracker · Built with React 19 + Vite 6 + Claude AI · Not financial advice
      </footer>
    </div>
  );
}
