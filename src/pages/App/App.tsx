import { Web3Provider } from '../../lib/web3/useWeb3';
import { IndexerProvider } from '../../lib/web3/indexerProvider';
import { ThemeProvider } from '../../lib/themeProvider';
import { ChakraProvider } from '@chakra-ui/react';

import { useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Header from '../../components/Header';
import Swap from '../Swap';
import Pool from '../Pool';

import theme from './theme';
import './App.scss';

function App() {
  const toastPortalRef = useRef(null);
  return (
    <Web3Provider>
      <IndexerProvider>
        <ChakraProvider
          theme={theme}
          toastOptions={{
            portalProps: { containerRef: toastPortalRef },
            defaultOptions: { position: 'top-right' },
          }}
        >
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
                <div className="toast-portal" ref={toastPortalRef}></div>
              </main>
            </BrowserRouter>
          </ThemeProvider>
        </ChakraProvider>
      </IndexerProvider>
    </Web3Provider>
  );
}

export default App;
