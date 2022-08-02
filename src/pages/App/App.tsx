import { Web3Provider } from '../../lib/web3/useWeb3';
import { IndexerProvider } from '../../lib/web3/indexerProvider';

import Header from '../../components/Header';
import { Router, RouterPage } from '../../components/Router';
import Swap from '../Swap';
import Pool from '../Pool';

import './App.scss';

export default function App() {
  return (
    <Web3Provider>
      <IndexerProvider>
        <Header />
        <main>
          <Router scrollCount={3}>
            <RouterPage index element={<div>Home</div>} />
            <RouterPage path="swap" element={<Swap />} />
            <RouterPage path="pool" element={<Pool />} />
            <RouterPage fallback element={<div>Not found</div>} />
          </Router>
        </main>
      </IndexerProvider>
    </Web3Provider>
  );
}
