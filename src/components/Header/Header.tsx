import { useCallback, useEffect, useState } from 'react';
import {
  Link,
  LinkProps,
  useResolvedPath,
  useLocation,
  useMatch,
} from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { useThemeMode } from '../../lib/themeProvider';

import logoWithText from '../../assets/logo/logo-with-text-white.svg';
import './Header.scss';

const keplrLogoURI =
  'https://raw.githubusercontent.com/chainapsis/keplr-wallet/master/docs/.vuepress/public/favicon-256.png';

const pageLinkMap = {
  '/': 'Trade',
  '/add-liquidity': 'Add Liquidity',
  '/my-liquidity': 'My Liquidity',
  '/stake': 'Stake',
};

export default function Header() {
  const { connectWallet, address } = useWeb3();
  const { themeMode, toggleThemeMode } = useThemeMode();

  const [menuIsOpen, setMenuIsOpen] = useState(false);
  const toggleMenuIsOpen = useCallback(
    () => setMenuIsOpen((menuIsOpen) => !menuIsOpen),
    []
  );

  // close menu whenever a new page has been navigated to
  const location = useLocation();
  useEffect(() => {
    setMenuIsOpen(false);
  }, [location.pathname]);

  return (
    <header className="container">
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
        <div className="col col-lg">
          <div className="row">
            {Object.entries(pageLinkMap).map(([link, description]) => (
              <div className="col" key={link}>
                <NavLink className="ghost-button" to={link}>
                  {description}
                </NavLink>
              </div>
            ))}
          </div>
        </div>
        <div className="col ml-auto">
          <div className="row">
            <div className="col hide">
              <button
                className="link no-blend"
                type="button"
                onClick={toggleThemeMode}
              >
                {themeMode === 'light' ? '🌕' : '🌞'}
              </button>
            </div>
            <div className="col col-lg-hide ml-auto">
              <button
                className={['ghost-button', menuIsOpen && 'focused']
                  .filter(Boolean)
                  .join(' ')}
                onClick={toggleMenuIsOpen}
              >
                <FontAwesomeIcon icon={faBars}></FontAwesomeIcon>
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
          </div>
        </div>
      </nav>
      <nav
        className={['mobile-nav col col-lg-hide', !menuIsOpen && 'hide']
          .filter(Boolean)
          .join(' ')}
      >
        <div className="container py-4">
          {Object.entries(pageLinkMap).map(([link, description]) => (
            <div className="col" key={link}>
              <NavLink className="ghost-button" to={link}>
                {description}
              </NavLink>
            </div>
          ))}
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
