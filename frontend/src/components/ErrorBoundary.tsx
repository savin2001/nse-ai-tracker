import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { logger } from "@/services/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Catches uncaught React render errors, logs them to the structured logger,
 * and renders a clean fallback UI rather than a blank screen.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(err: Error, info: { componentStack: string }): void {
    logger.error("react_render_error", {
      message: err.message,
      stack:   err.stack,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center p-8">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <div>
          <p className="text-white font-semibold mb-1">Something went wrong</p>
          <p className="text-sm text-gray-500 font-mono">{this.state.message}</p>
        </div>
        <button
          onClick={() => this.setState({ hasError: false, message: "" })}
          className="text-xs px-4 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-gray-400 hover:text-white transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }
}
