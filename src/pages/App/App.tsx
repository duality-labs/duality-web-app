import { Web3Provider } from '../../lib/web3/Web3Context';
import { ThemeProvider } from '../../lib/theme/themeProvider';

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Header from '../../components/Header';
import Notifications from '../../components/Notifications';
import { defaultPage } from '../../components/Header/routes';

import Stars from './Stars';
import Planets from './Planets';
import Swap from '../Swap';
import Pool from '../Pool';
import Bridge from '../Bridge';
import Orderbook from '../Orderbook/Orderbook';
import MyLiquidity from '../MyLiquidity';
// you would think the import order here doesn't matter, but you would be wrong
// the Trade page must be imported after Pool so that .table-card styles
// aren't overridden by page-card styles :(

import './App.scss';
import { Component, ErrorInfo, ReactNode } from 'react';

const queryClient = new QueryClient();

function App() {
  return (
    <ErrorBoundary fallback={Fallback}>
      <Web3Provider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <BrowserRouter>
              <Header />
              <Stars />
              <Planets />
              <main>
                <Routes>
                  <Route index element={<Navigate to={defaultPage} />} />
                  <Route path="swap/*" element={<Swap />} />
                  <Route path="pools/*" element={<Pool />} />
                  <Route path="orderbook/*" element={<Orderbook />} />
                  <Route path="portfolio/*" element={<MyLiquidity />} />
                  <Route path="bridge" element={<Bridge />} />
                  <Route path="*" element={<div>Not found</div>} />
                </Routes>
                <Notifications />
              </main>
            </BrowserRouter>
          </ThemeProvider>
        </QueryClientProvider>
      </Web3Provider>
    </ErrorBoundary>
  );
}

export default App;

function Fallback({ error }: { error?: Error }) {
  return (
    <div>
      error ({typeof error}): {JSON.stringify(error)}
    </div>
  );
}

class ErrorBoundary extends Component<{
  fallback: (props: { error?: Error }) => ReactNode;
  children: ReactNode;
}> {
  state: { didCatch: boolean; error?: Error } = { didCatch: false };

  constructor(props: {
    fallback: (props: { error?: Error }) => ReactNode;
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
      return this.props.fallback({ error: this.state.error });
    }

    return this.props.children;
  }
}
