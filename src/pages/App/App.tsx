import { Web3Provider } from '../../lib/web3/useWeb3';
import { ThemeProvider } from '../../lib/themeProvider';

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Header from '../../components/Header';
import Notifications from '../../components/Notifications';
import { defaultPage } from '../../components/Header/Header';

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

const queryClient = new QueryClient();

function App() {
  return (
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
  );
}

export default App;
