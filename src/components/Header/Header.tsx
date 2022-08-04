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
    <header className="flex flex-row items-center justify-start w-full text-xl">
      <nav className="w-full p-4 inline-flex items-end shadow shadow-white/10 text-slate-50">
        <Link className="ml-3 inline-flex items-center" to="/">
          <img src={logo} className="logo inline h-6 mr-3" alt="logo" />
          <h1 className="inline text-3xl">Duality</h1>
        </Link>
        <Link className="ml-3" to="/swap">
          Swap
        </Link>
        <Link className="ml-3" to="/pool">
          Pool
        </Link>
        {address ? (
          <span className="ml-3">{address}</span>
        ) : (
          <button className="ml-3" onClick={onConnectClick}>
            Connect Wallet
          </button>
        )}
        <button className="ml-3" type="button" onClick={toggleThemeMode}>
          {themeMode === 'light' ? '🌕' : '🌞'}
        </button>
      </nav>
    </header>
  );
}
