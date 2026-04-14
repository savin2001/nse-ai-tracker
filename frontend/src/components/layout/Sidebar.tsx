import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, BriefcaseBusiness, Bell,
  Settings, TrendingUp, LogOut,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";

const links = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/portfolio",  icon: BriefcaseBusiness, label: "Portfolio" },
  { to: "/events",     icon: Bell,              label: "Events" },
  { to: "/settings",   icon: Settings,          label: "Settings" },
];

export default function Sidebar() {
  const { signOut } = useAuth();

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-zinc-900 border-r border-white/5 px-3 py-6">
      {/* Logo */}
      <div className="flex items-center gap-2 px-2 mb-8">
        <TrendingUp className="w-5 h-5 text-emerald-400" strokeWidth={2.5} />
        <span className="text-sm font-bold text-white tracking-wide">NSE AI Tracker</span>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-1 flex-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 font-medium"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-colors mt-4"
      >
        <LogOut className="w-4 h-4 shrink-0" />
        Sign out
      </button>
    </aside>
  );
}
