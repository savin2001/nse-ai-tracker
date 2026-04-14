import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { TrendingUp, Eye, EyeOff, AlertCircle, ArrowLeft, Sparkles } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import GradientBackground from "../components/ui/GradientBackground";

export default function LoginPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  if (user) { navigate("/dashboard", { replace: true }); return null; }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await signIn(email.trim(), password);
    if (err) { setError(err); setLoading(false); }
    else      { navigate("/dashboard", { replace: true }); }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 relative overflow-hidden">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-center gap-2.5 mb-8"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <TrendingUp size={15} className="text-emerald-400" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-white tracking-tight">NSE AI Tracker</span>
        </motion.div>

        {/* Glassmorphism card */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative rounded-2xl border border-white/9 glass shadow-2xl p-7"
        >
          {/* Gradient top line */}
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/45 to-transparent rounded-full" />

          <div className="mb-6">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles size={12} className="text-purple-400" />
              <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">Secure sign in</span>
            </div>
            <h1 className="text-xl font-semibold text-white">Welcome back</h1>
            <p className="text-xs text-gray-500 mt-1">
              No account?{" "}
              <a href="mailto:admin@example.com" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                Contact admin
              </a>
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 mb-5 px-3 py-2.5 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400"
            >
              <AlertCircle size={13} className="shrink-0" />
              <span className="text-xs">{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Email address</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/4 border border-white/8 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 focus:bg-emerald-500/3 transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-white/4 border border-white/8 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 focus:bg-emerald-500/3 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm transition-all shadow-lg shadow-emerald-500/20"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                  Signing in…
                </span>
              ) : "Sign in"}
            </motion.button>
          </form>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-5"
        >
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-300 transition-colors">
            <ArrowLeft size={11} />
            Back to home
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
