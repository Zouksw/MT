"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Error Boundary caught an error:", error, errorInfo);
    if (typeof window !== "undefined" && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
    }
    this.setState({ error, errorInfo });
  }

  handleReset = (): void => { this.setState({ hasError: false, error: null, errorInfo: null }); };
  handleReload = (): void => { window.location.reload(); };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isDevelopment = process.env.NODE_ENV === "development";

      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center max-w-lg">
            <TriangleAlert className="size-16 text-amber-600 mx-auto mb-4" strokeWidth={1.5} />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-6">An unexpected error occurred. Please try again or contact support.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={this.handleReset} className="px-5 py-2.5 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors">Try Again</button>
              <button onClick={this.handleReload} className="px-5 py-2.5 rounded-lg bg-card text-gray-900 dark:text-gray-100 font-medium border hover:bg-accent transition-colors">Reload Page</button>
            </div>
            {isDevelopment && this.state.error && (
              <pre className="mt-6 bg-muted p-4 rounded-lg text-left text-xs max-h-72 overflow-auto">
                <strong>Message:</strong> {this.state.error.message}{"\n\n"}
                <strong>Stack:</strong> {this.state.error.stack}
                {this.state.errorInfo && <>{`\n\nComponent Stack: ${this.state.errorInfo.componentStack}`}</>}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
