import { Component, ErrorInfo, ReactNode } from 'react';
import { audioManager } from '@/utils/audioManager';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Detect iOS PWA mode
    const isIOSPWA = ('standalone' in window.navigator) && (window.navigator as any).standalone === true;
    const isIOSSafari = /iPhone|iPad|iPod/.test(navigator.userAgent);
    
    // Check if this is an audio-related error
    const isAudioError = error.message?.toLowerCase().includes('audio') || 
                        error.message?.toLowerCase().includes('play') ||
                        error.message?.toLowerCase().includes('media') ||
                        error.stack?.toLowerCase().includes('audioplayer');
    
    // Error caught by boundary - details available for debugging if needed

    // Try to save error to sessionStorage for recovery
    try {
      sessionStorage.setItem('last_error:v1', JSON.stringify({
        message: error.message,
        isAudioError,
        timestamp: Date.now()
      }));
    } catch (e) {
      // Storage not available
    }

    // If it's an audio error, try to reset audio state
    if (isAudioError) {
      try {
        audioManager.stopSong();
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    this.setState({
      error,
      errorInfo
    });
  }

  private handleReload = () => {
    try {
      // Clear error state from storage
      sessionStorage.removeItem('last_error:v1');
      
      // For iOS PWA, use location.href instead of reload() for better compatibility
      const isIOSPWA = ('standalone' in window.navigator) && (window.navigator as any).standalone === true;
      
      if (isIOSPWA) {
        window.location.href = window.location.href.split('?')[0] + '?t=' + Date.now();
      } else {
        window.location.reload();
      }
    } catch (e) {
      // Fallback to simple reload
      window.location.reload();
    }
  };

  private handleGoHome = () => {
    try {
      sessionStorage.removeItem('last_error:v1');
      window.location.href = '/';
    } catch (e) {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback && this.state.error && this.state.errorInfo) {
        return this.props.fallback(this.state.error, this.state.errorInfo);
      }

      const isIOSPWA = ('standalone' in window.navigator) && (window.navigator as any).standalone === true;

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
          <div className="text-center max-w-md">
            <h1 className="text-4xl font-semibold mb-4 text-foreground">Something went wrong</h1>
            <p className="text-muted-foreground mb-4">
              We're sorry, but there was an error loading this page.
            </p>
            {isIOSPWA && (
              <p className="text-sm text-muted-foreground mb-8">
                If this keeps happening, try closing the app completely and reopening it.
              </p>
            )}
            {this.state.error && (
              <details className="text-left bg-card p-4 rounded-lg mb-4">
                <summary className="cursor-pointer text-sm text-muted-foreground mb-2">
                  Error Details
                </summary>
                <pre className="text-xs text-red-500 overflow-auto whitespace-pre-wrap max-h-40">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <div className="flex gap-3 justify-center">
              <button type="button"
                onClick={this.handleReload}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Refresh Page
              </button>
              <button type="button"
                onClick={this.handleGoHome}
                className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

