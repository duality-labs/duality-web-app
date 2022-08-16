import { Link } from 'react-router-dom';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { useThemeMode } from '../../lib/themeProvider';

import logo from '../../assets/logo/logo.svg';

export default function Header() {
  const { connectWallet, address } = useWeb3();
  const { themeMode, toggleThemeMode } = useThemeMode();

  const onConnectClick = () => {
    connectWallet && connectWallet();
  };

  return (
    <header>
      <nav>
        <Link to="/">
          <img src={logo} className="logo" alt="logo" />
          <h1>Duality</h1>
        </Link>
        <Link to="/swap">Swap</Link>
        <Link to="/pool">Pool</Link>
        {address ? (
          <span className="link">{address}</span>
        ) : (
          <button className="link" onClick={onConnectClick}>
            Connect Wallet
          </button>
        )}
        <button className="link" type="button" onClick={toggleThemeMode}>
          {themeMode === 'light' ? '🌕' : '🌞'}
        </button>
      </nav>
    </header>
  );
}
