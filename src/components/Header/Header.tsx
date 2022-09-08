import { Link, LinkProps, useResolvedPath, useMatch } from 'react-router-dom';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { useThemeMode } from '../../lib/themeProvider';

import logo from '../../assets/logo/logo.svg';

import './Header.scss';

export default function Header() {
  const { connectWallet, address } = useWeb3();
  const { themeMode, toggleThemeMode } = useThemeMode();

  const onConnectClick = () => {
    connectWallet && connectWallet();
  };

  return (
    <header>
      <nav>
        <NavLink className="logo mr-5" to="/">
          <h1>Duality</h1>
        </NavLink>
        <NavLink className="ghost-button" to="/">
          Home
        </NavLink>
        <NavLink className="ghost-button" to="/swap">
          Trade
        </NavLink>
        <NavLink className="ghost-button" to="/pool">
          Liquidity
        </NavLink>
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
        <button className="user-profile">
          <img src={logo} className="logo" alt="logo" />
          <div>User</div>
        </button>
      </nav>
    </header>
  );
}

function NavLink({ to, children, className, ...otherProps }: LinkProps) {
  const resolved = useResolvedPath(to);
  const match = useMatch({ path: resolved.pathname, end: true });
  const activeClassName = match ? 'active' : '';
  const fullClassName = [className, activeClassName].filter(Boolean).join(' ');

  return (
    <Link to={to} className={fullClassName} {...otherProps}>
      {children}
    </Link>
  );
}
