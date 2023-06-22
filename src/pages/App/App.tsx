import { Web3Provider, useWeb3 } from '../../lib/web3/useWeb3';
import { IndexerProvider } from '../../lib/web3/indexerProvider';
import { ThemeProvider } from '../../lib/themeProvider';

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Header from '../../components/Header';
import Notifications from '../../components/Notifications';

import Stars from './Stars';
import Planets from './Planets';
import Swap from '../Swap';
import Pool from '../Pool';
import MyLiquidity from '../MyLiquidity';
// you would think the import order here doesn't matter, but you would be wrong
// the Trade page must be imported after Pool so that .table-card styles
// aren't overridden by page-card styles :(

import './App.scss';

const queryClient = new QueryClient();

function MyLiquidityOrSwap() {
  const { address } = useWeb3();
  return address ? <Navigate to="/portfolio" /> : <Navigate to="/swap" />;
}

function App() {
  return (
    <Web3Provider>
      <IndexerProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <Header />
              <Stars />
              <Planets />
              <main>
                <Routes>
                  <Route index element={<MyLiquidityOrSwap />} />
                  <Route path="swap" element={<Swap />} />
                  <Route path="pools/*" element={<Pool />} />
                  <Route path="portfolio" element={<MyLiquidity />} />
                  <Route path="stake" element={<div>Coming soon</div>} />
                  <Route path="*" element={<div>Not found</div>} />
                </Routes>
                <Notifications />
              </main>
            </BrowserRouter>
          </QueryClientProvider>
        </ThemeProvider>
      </IndexerProvider>
    </Web3Provider>
  );
}

export default App;
