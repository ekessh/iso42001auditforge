// SPDX-License-Identifier: BUSL-1.1
'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import * as React from 'react';

import { Button } from './Button';

interface ErrorBoundaryProps {
  fallback?: (props: { error: Error; reset: () => void }) => React.ReactNode;
  onError?: (error: Error, info: React.ErrorInfo) => void;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) {
      return this.props.fallback({ error, reset: this.reset });
    }
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 text-destructive" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">Something went wrong.</p>
            <p className="mt-1 break-words text-xs text-muted-foreground">{error.message}</p>
          </div>
          <Button size="sm" variant="outline" iconLeft={<RefreshCw />} onClick={this.reset}>
            Try again
          </Button>
        </div>
      </div>
    );
  }
}
