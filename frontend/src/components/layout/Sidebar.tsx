import { NavLink } from "react-router-dom";
import { motion } from "motion/react";
import {
  LayoutDashboard, BriefcaseBusiness, Bell,
  Settings, TrendingUp, LogOut, Activity, X,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";

const LINKS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/portfolio",  icon: BriefcaseBusiness, label: "Portfolio" },
  { to: "/events",     icon: Bell,              label: "Events"    },
  { to: "/settings",   icon: Settings,          label: "Settings"  },
];

interface Props {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onClose }: Props) {
  const { signOut, user } = useAuth();
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();
  const handle   = user?.email?.split("@")[0] ?? "";

  const inner = (
    <aside
      className="flex flex-col w-[224px] min-h-screen border-r border-white/5 px-3 py-5"
      style={{ background: "#060606" }}
    >
      {/* Logo + mobile close */}
      <div className="flex items-center justify-between px-2 mb-8">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <TrendingUp size={13} className="text-emerald-400" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-sm font-bold text-white tracking-tight block leading-none">NSE AI</span>
            <span className="text-[9px] text-gray-600 font-mono uppercase tracking-wider">Tracker</span>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-gray-500 hover:text-white p-1">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Section label */}
      <p className="px-3 mb-2 text-[9px] font-mono text-gray-700 uppercase tracking-widest">Navigation</p>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {LINKS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                isActive
                  ? "bg-emerald-500/8 text-emerald-400 font-medium"
                  : "text-gray-500 hover:text-white hover:bg-white/5"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-pill"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-emerald-400"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon size={15} className="shrink-0" />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Live status widget */}
      <div className="mx-1 mb-3">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.025] border border-white/5">
          <div className="relative shrink-0">
            <Activity size={12} className="text-emerald-400" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 font-medium leading-none">Market Live</div>
            <div className="text-[9px] text-gray-600 font-mono mt-0.5">NSE · Africa/Nairobi</div>
          </div>
        </div>
      </div>

      {/* User row + sign out */}
      <div className="border-t border-white/5 pt-3">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-0.5">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[9px] font-bold text-emerald-400 shrink-0">
            {initials}
          </div>
          <span className="text-xs text-gray-500 truncate">{handle}</span>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-red-400 hover:bg-red-500/5 transition-all"
        >
          <LogOut size={14} className="shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible md+ */}
      <div className="hidden md:block">{inner}</div>

      {/* Mobile drawer — slides in from left */}
      <div
        className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {inner}
      </div>
    </>
  );
}
