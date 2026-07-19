// Top-level containment for unexpected render errors (§2.4). A thrown error in
// any screen would otherwise unmount the whole React tree, leaving a blank
// page. This catches it and shows a recoverable fallback. The event-sourced
// save is untouched — the campaign can be resumed from the menu — so the
// safest recovery is a full reload back to the main menu.

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No telemetry backend (offline app); log for local debugging only.
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary-card">
          <h1>Something went wrong</h1>
          <p>
            The command interface hit an unexpected error. Your saved campaigns are stored
            separately and are unaffected — reload to return to the main menu and resume.
          </p>
          <pre className="error-boundary-detail">{error.message}</pre>
          <button type="button" className="primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
