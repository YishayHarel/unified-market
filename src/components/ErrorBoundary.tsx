import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

/**
 * Error Boundary component that catches JavaScript errors in child components
 * Prevents the entire app from crashing and displays a user-friendly error UI
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Generate a unique error ID for reference
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}`;
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error safely without exposing sensitive information
    const safeErrorLog = {
      errorId: this.state.errorId,
      message: error.message,
      timestamp: new Date().toISOString(),
      componentStack: errorInfo.componentStack?.split('\n').slice(0, 5).join('\n'),
      url: window.location.pathname,
    };

    console.error('[ErrorBoundary] Caught error:', safeErrorLog);

    // Store in localStorage for debugging (last 5 errors)
    try {
      const storedErrors = JSON.parse(localStorage.getItem('error_boundary_logs') || '[]');
      storedErrors.unshift(safeErrorLog);
      localStorage.setItem('error_boundary_logs', JSON.stringify(storedErrors.slice(0, 5)));
    } catch (e) {
      // Silently fail - localStorage might be full or disabled
    }

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-destructive/10 w-fit">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-xl">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                We encountered an unexpected error. This has been logged and we'll look into it.
              </p>
              
              {this.state.errorId && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground text-center">
                    Error Reference: <code className="font-mono">{this.state.errorId}</code>
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={this.handleRetry}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button
                  onClick={this.handleGoHome}
                  className="gap-2"
                >
                  <Home className="h-4 w-4" />
                  Go Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

/**
 * Hook-style wrapper for functional components
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
