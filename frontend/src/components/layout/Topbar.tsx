import { TrendingUp } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";

export default function Topbar() {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-black/80 backdrop-blur border-b border-white/5 md:hidden">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-emerald-400" strokeWidth={2.5} />
        <span className="text-sm font-bold text-white">NSE AI Tracker</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 truncate max-w-32">{user?.email}</span>
        <button
          onClick={signOut}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
