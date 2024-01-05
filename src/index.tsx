// Import polyfills for IE11
import 'react-app-polyfill/ie11';
import 'react-app-polyfill/stable';

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './index.scss';

// add Buffer.from support for '@duality-labs/dualityjs'
import { Buffer } from 'buffer';
global.Buffer = Buffer;

// ensure App is loaded after Buffer because Keplr needs it on import
const App = React.lazy(() => import('./pages/App'));

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
