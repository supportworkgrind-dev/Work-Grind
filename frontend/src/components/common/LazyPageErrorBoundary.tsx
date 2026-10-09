'use client';

import * as React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export class LazyPageErrorBoundary extends React.Component<{
  children: React.ReactNode;
  title?: string;
  description?: string;
}, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy page failed to load:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center px-6 py-12">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm max-w-md w-full" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-rose-100 p-2 text-rose-600">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-rose-700">{this.props.title ?? 'This page could not be loaded.'}</p>
                <p className="text-sm text-rose-700/80">
                  {this.props.description ?? 'The page bundle failed to load. Please retry in a moment.'}
                </p>
                <button
                  type="button"
                  onClick={() => this.setState({ hasError: false })}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
