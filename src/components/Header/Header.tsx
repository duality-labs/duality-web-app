import { Link, useLocation } from 'react-router-dom';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { useThemeMode } from '../../lib/themeProvider';

import logo from '../../assets/logo/logo.svg';

import './Header.scss';
import { useCallback } from 'react';

export default function Header() {
  const { connectWallet, address } = useWeb3();
  const { themeMode, toggleThemeMode } = useThemeMode();
  const { pathname } = useLocation();
  const getSelectedClass = useCallback(
    (path: string) => (path === pathname ? 'selected' : ''),
    [pathname]
  );

  const onConnectClick = () => {
    connectWallet && connectWallet();
  };

  return (
    <header>
      <nav>
        <Link to="/" className={getSelectedClass('/')}>
          <img src={logo} className="logo" alt="logo" />
          <h1>Duality</h1>
        </Link>
        <Link to="/swap" className={getSelectedClass('/swap')}>
          Swap
        </Link>
        <Link to="/pool" className={getSelectedClass('/pool')}>
          Pool
        </Link>
        {address ? (
          <span className="link">{address}</span>
        ) : (
          <button className="link" onClick={onConnectClick}>
            Connect Wallet
          </button>
        )}
        <button
          className="link no-blend"
          type="button"
          onClick={toggleThemeMode}
        >
          {themeMode === 'light' ? '🌕' : '🌞'}
        </button>
      </nav>
    </header>
  );
}
