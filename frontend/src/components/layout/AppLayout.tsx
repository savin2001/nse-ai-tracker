import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout() {
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-black">
      {/* Mobile nav backdrop */}
      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      <Sidebar mobileOpen={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0">
        <Topbar onMenuClick={() => setNavOpen(v => !v)} />
        <main className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
