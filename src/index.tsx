import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './index.scss';

// add fixes for globals before any of the app and dependencies are loaded
import './global-fixes';

// ensure App is loaded after Buffer fix because Keplr needs it on import
import App from './pages/App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
