'use client';

import React, { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error caught by ErrorBoundary:', error);
    console.error('Component stack:', errorInfo.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Fallback UI when an error occurs
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>We're sorry, an error occurred while rendering this component.</p>
          <details>
            <summary>Error details</summary>
            <pre>{this.state.error?.message}</pre>
          </details>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
          <style jsx>{`
            .error-boundary {
              padding: 20px;
              border: 1px solid var(--color-error);
              border-radius: var(--border-radius);
              background-color: rgba(244, 67, 54, 0.05);
              margin: 20px 0;
            }
            
            h2 {
              color: var(--color-error);
              margin-top: 0;
              margin-bottom: 10px;
            }
            
            details {
              margin: 15px 0;
            }
            
            pre {
              background-color: var(--color-background-alt);
              padding: 10px;
              border-radius: 4px;
              overflow-x: auto;
            }
            
            button {
              background-color: var(--color-primary);
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              font-weight: bold;
              cursor: pointer;
            }
            
            button:hover {
              background-color: var(--color-primary-dark);
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;