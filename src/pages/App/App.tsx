import { Web3Provider } from '../../lib/web3/useWeb3';
import { IndexerProvider } from '../../lib/web3/indexerProvider';
import { ThemeProvider } from '../../lib/themeProvider';
import { ChakraProvider } from '@chakra-ui/react';

import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Header from '../../components/Header';
import Swap from '../Swap';
import Pool from '../Pool';

import './App.scss';

function App() {
  return (
    <Web3Provider>
      <IndexerProvider>
        <ChakraProvider>
          <ThemeProvider>
            <BrowserRouter>
              <Header />
              <main>
                <Routes>
                  <Route index element={<Swap />} />
                  <Route path="add-liquidity" element={<Pool />} />
                  <Route path="my-liquidity" element={<div>Coming soon</div>} />
                  <Route path="stake" element={<div>Coming soon</div>} />
                  <Route path="*" element={<div>Not found</div>} />
                </Routes>
              </main>
            </BrowserRouter>
          </ThemeProvider>
        </ChakraProvider>
      </IndexerProvider>
    </Web3Provider>
  );
}

export default App;
