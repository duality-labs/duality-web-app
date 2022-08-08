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
  const selected = useCallback(
    (path: string) => (path === pathname ? 'selected' : ''),
    [pathname]
  );

  const onConnectClick = () => {
    connectWallet && connectWallet();
  };

  return (
    <header>
      <nav>
        <Link to="/" className={selected('/')}>
          <img src={logo} className="logo" alt="logo" />
          <h1>Duality</h1>
        </Link>
        <Link to="/swap" className={selected('/swap')}>
          Swap
        </Link>
        <Link to="/pool" className={selected('/pool')}>
          Pool
        </Link>
        {address ? (
          <span>{address}</span>
        ) : (
          <button onClick={onConnectClick} className="link">
            Connect Wallet
          </button>
        )}
        <button className="ml3 link" type="button" onClick={toggleThemeMode}>
          {themeMode === 'light' ? '🌕' : '🌞'}
        </button>
      </nav>
    </header>
  );
}
