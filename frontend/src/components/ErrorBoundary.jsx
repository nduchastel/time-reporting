// frontend/src/components/ErrorBoundary.jsx
// Catches render-time crashes, reports them (no-op unless a DSN is configured),
// and shows a recoverable fallback instead of a blank white screen.
import { Component } from 'react';
import { captureError } from '../lib/errorReporter';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    captureError(error, { kind: 'react', componentStack: info?.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="text-gray-600">The app hit an unexpected error. Reloading usually fixes it.</p>
          <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-4 py-2 rounded font-semibold">Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}
