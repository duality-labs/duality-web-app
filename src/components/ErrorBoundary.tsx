import { Component, ErrorInfo, ReactNode } from 'react';

export default class ErrorBoundary extends Component<{
  fallback?: (props: { error?: Error }) => ReactNode;
  children: ReactNode;
}> {
  state: { didCatch: boolean; error?: Error } = { didCatch: false };

  constructor(props: {
    fallback?: (props: { error?: Error }) => ReactNode;
    children: ReactNode;
  }) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    // Update state so the next render will show the fallback UI.
    return { didCatch: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Example "componentStack":
    //   in ComponentThatThrows (created by App)
    //   in ErrorBoundary (created by App)
    //   in div (created by App)
    //   in App
    // eslint-disable-next-line no-console
    console.error(error, info.componentStack);
  }

  render() {
    if (this.state.didCatch) {
      // You can render any custom fallback UI
      const fallback = this.props.fallback || defaultFallback;
      return fallback({ error: this.state.error });
    }

    return this.props.children;
  }
}

// generic fallback component to render the no specific error
function defaultFallback() {
  return (
    <div style={{ margin: 'auto', padding: '2em' }}>
      An error occurred, refresh the page to try again
    </div>
  );
}
