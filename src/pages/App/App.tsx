import { Web3Provider, useWeb3 } from '../../lib/web3/useWeb3';
import { IndexerProvider } from '../../lib/web3/indexerProvider';
import { ThemeProvider } from '../../lib/themeProvider';

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navigate } from 'react-router';

import Header from '../../components/Header';
import Notifications from '../../components/Notifications';

import Swap from '../Swap';
import Pool from '../Pool';
import MyLiquidity from '../MyLiquidity';

import './App.scss';

function MyLiquidityOrTrade() {
  const { address } = useWeb3();
  return address ? <MyLiquidity /> : <Navigate to="/trade" />;
}

function App() {
  return (
    <Web3Provider>
      <IndexerProvider>
        <ThemeProvider>
          <BrowserRouter>
            <Header />
            <main>
              <Routes>
                <Route index element={<MyLiquidityOrTrade />} />
                <Route path="trade" element={<Swap />} />
                <Route path="liquidity" element={<Pool />} />
                <Route path="stake" element={<div>Coming soon</div>} />
                <Route path="*" element={<div>Not found</div>} />
              </Routes>
              <Notifications />
            </main>
          </BrowserRouter>
        </ThemeProvider>
      </IndexerProvider>
    </Web3Provider>
  );
}

export default App;
