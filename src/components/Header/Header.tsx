import { Link, LinkProps, useResolvedPath, useMatch } from 'react-router-dom';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { useThemeMode } from '../../lib/themeProvider';

import logoWithText from '../../assets/logo/logo-with-text-white.svg';
import './Header.scss';

const keplrLogoURI =
  'https://raw.githubusercontent.com/chainapsis/keplr-wallet/master/docs/.vuepress/public/favicon-256.png';

export default function Header() {
  const { connectWallet, address } = useWeb3();
  const { themeMode, toggleThemeMode } = useThemeMode();

  return (
    <header>
      <nav>
        <NavLink className="logo mr-5" to="/">
          <h1 className="font-brand">
            <img src={logoWithText} alt="Duality"></img>
          </h1>
        </NavLink>
        <NavLink className="ghost-button" to="/">
          Trade
        </NavLink>
        <NavLink className="ghost-button" to="/add-liquidity">
          Add Liquidity
        </NavLink>
        <NavLink className="ghost-button" to="/my-liquidity">
          My Liquidity
        </NavLink>
        <NavLink className="ghost-button" to="/stake">
          Stake
        </NavLink>
        <button
          className="link no-blend hide"
          type="button"
          onClick={toggleThemeMode}
        >
          {themeMode === 'light' ? '🌕' : '🌞'}
        </button>
        {address ? (
          <button className="user-profile ml-auto">
            <img src={keplrLogoURI} className="logo  mr-3" alt="logo" />
            <div>{address.slice(0, 10)}...</div>
          </button>
        ) : (
          <button
            className="link connect-wallet ml-auto button-primary"
            onClick={connectWallet}
          >
            Connect Wallet
          </button>
        )}
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
