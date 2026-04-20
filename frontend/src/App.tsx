import { type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import AppLayout from "./components/layout/AppLayout";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import TrendsPage from "./pages/TrendsPage";
import PortfolioPage from "./pages/PortfolioPage";
import EventsPage from "./pages/EventsPage";
import SettingsPage from "./pages/SettingsPage";

/** Redirect unauthenticated users to /login */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Protected — wrapped in AppLayout (Sidebar + Topbar) */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/trends"    element={<TrendsPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/events"    element={<EventsPage />} />
        <Route path="/settings"  element={<SettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
