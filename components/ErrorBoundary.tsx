import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State;
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);

    const isModuleError =
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('dynamically imported module') ||
      error?.message?.includes('Loading chunk') ||
      error?.name === 'ChunkLoadError';

    if (isModuleError) {
      const storageKey = 'rapid911_module_retry';
      const lastRetry = sessionStorage.getItem(storageKey);
      if (!lastRetry || Date.now() - Number(lastRetry) > 10000) {
        sessionStorage.setItem(storageKey, String(Date.now()));
        window.location.reload();
      }
    }
  }

  private handleRetry = () => {
    (this as any).setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="p-4 bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-2xl max-w-md w-full shadow-lg space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto text-2xl font-bold">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Something went wrong loading this view
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {this.state.error?.message || 'A network or module loading issue occurred.'}
              </p>
            </div>
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
            >
              🔄 Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
