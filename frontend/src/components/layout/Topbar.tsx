import { Menu, TrendingUp, LogOut } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";

interface Props {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: Props) {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 glass border-b border-white/5 md:hidden">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <TrendingUp size={11} className="text-emerald-400" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-bold text-white tracking-tight">NSE AI Tracker</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 truncate max-w-[120px] hidden xs:block">{user?.email}</span>
        <button
          onClick={signOut}
          className="flex items-center gap-1 text-xs text-gray-600 hover:text-red-400 transition-colors"
          aria-label="Sign out"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}
