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
      <nav className="row">
        <div className="col">
          <NavLink className="logo mr-5" to="/">
            <h1 className="font-brand">
              <img
                src={logoWithText}
                alt="Duality"
                onError={({ currentTarget }) => {
                  currentTarget.outerHTML = 'Duality';
                }}
              ></img>
            </h1>
          </NavLink>
        </div>
        <div className="col">
          <NavLink className="ghost-button" to="/">
            Trade
          </NavLink>
        </div>
        <div className="col">
          <NavLink className="ghost-button" to="/add-liquidity">
            Add Liquidity
          </NavLink>
        </div>
        <div className="col">
          <NavLink className="ghost-button" to="/my-liquidity">
            My Liquidity
          </NavLink>
        </div>
        <div className="col">
          <NavLink className="ghost-button" to="/stake">
            Stake
          </NavLink>
        </div>
        <div className="col hide">
          <button
            className="link no-blend"
            type="button"
            onClick={toggleThemeMode}
          >
            {themeMode === 'light' ? '🌕' : '🌞'}
          </button>
        </div>
        <div className="col ml-auto">
          {address ? (
            <button className="user-profile ml-auto">
              <img src={keplrLogoURI} className="logo  mr-3" alt="logo" />
              <div className="text-truncate">{address}</div>
            </button>
          ) : (
            <button
              className="link connect-wallet ml-auto button-primary"
              onClick={connectWallet}
            >
              Connect Wallet
            </button>
          )}
        </div>
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
