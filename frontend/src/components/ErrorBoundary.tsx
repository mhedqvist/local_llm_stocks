import React from 'react';

/**
 * ErrorBoundary
 * ==============
 * Catches render-time errors in a subtree so one broken component (e.g. a
 * chart pane fed malformed data) cannot take down the whole workspace.
 *
 * - Per-pane instances are wired in `WorkspaceGrid` (one pane failing keeps
 *   the others interactive).
 * - A top-level instance is wired in `App` with a full-reload fallback.
 *
 * Retry remounts the children subtree via a key bump, which resets
 * component state and re-runs effects (re-fetch + reconnect).
 */

interface ErrorBoundaryProps {
  /** Human label shown in the fallback, e.g. "AAPL pane". */
  label: string;
  children: React.ReactNode;
  /**
   * Optional custom fallback. Receives the caught error and a `retry`
   * function. When omitted, a default compact card is rendered.
   */
  fallback?: (error: Error, retry: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  resetKey: number;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Pick<ErrorBoundaryState, 'error'> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[ErrorBoundary:${this.props.label}]`, error, info.componentStack);
  }

  private retry = (): void => {
    this.setState((s) => ({ error: null, resetKey: s.resetKey + 1 }));
  };

  render(): React.ReactNode {
    if (this.state.error) {
      const { fallback, label } = this.props;
      if (fallback) {
        return fallback(this.state.error, this.retry);
      }
      return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-rose-900/60 bg-slate-950 p-4 text-sm text-slate-300 min-h-[200px]">
          <div className="font-semibold text-rose-400">{label} failed to render</div>
          <div className="max-w-md break-words text-center text-xs text-slate-500">
            {this.state.error.message}
          </div>
          <button
            onClick={this.retry}
            className="mt-2 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
          >
            Retry
          </button>
        </div>
      );
    }
    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

export default ErrorBoundary;
