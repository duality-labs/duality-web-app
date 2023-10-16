// Import polyfills for IE11
import 'react-app-polyfill/ie11';
import 'react-app-polyfill/stable';

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './index.scss';
import reportWebVitals from './reportWebVitals';

// add Buffer.from support for '@duality-labs/dualityjs'
import { Buffer } from 'buffer';
global.Buffer = Buffer;

// in development, clear the fetch API cache on each reload
const { NODE_ENV } = process.env;
if (NODE_ENV !== 'production') {
  if ('caches' in window) {
    caches
      .keys()
      .then((cacheKeys) => {
        return Promise.all(
          cacheKeys.map((cacheKey) => caches.delete(cacheKey))
        );
      })
      .then(() => {
        // eslint-disable-next-line no-console
        console.log('cleared fetch API caches');
      });
  }
}

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

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
