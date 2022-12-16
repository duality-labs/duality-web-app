import { useCallback, useEffect, useState } from 'react';
import { Link, LinkProps, useResolvedPath, useMatch } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { useThemeMode } from '../../lib/themeProvider';

import Drawer from '../Drawer';
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

  const closeMenuAndScrollToTop = useCallback(() => {
    setMenuIsOpen(false);
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth',
    });
  }, []);

  // add extra style is page has been scrolled
  const [pageIsScrolled, setPageIsScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setPageIsScrolled(!!window.pageYOffset);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <header
      className={[(pageIsScrolled || menuIsOpen) && 'scrolled']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="container py-5">
        <nav className="row gap-4">
          <div className="col">
            <NavLink className="logo" to="/" onClick={closeMenuAndScrollToTop}>
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
            <div className="row gap-4 ml-5">
              {Object.entries(pageLinkMap).map(([link, description]) => (
                <div className="col" key={link}>
                  <NavLink
                    className="button ghost-button"
                    to={link}
                    onClick={closeMenuAndScrollToTop}
                  >
                    {description}
                  </NavLink>
                </div>
              ))}
            </div>
          </div>
          <div className="col ml-auto">
            <div className="row gap-4">
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
                  className={[
                    'button',
                    'more-button',
                    'ghost-button',
                    menuIsOpen && 'focused',
                  ]
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
                    <img src={keplrLogoURI} className="logo mr-3" alt="logo" />
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
        <nav className="col col-lg-hide">
          <Drawer className="pt-4" expanded={menuIsOpen}>
            {Object.entries(pageLinkMap).map(([link, description]) => (
              <div className="col" key={link}>
                <NavLink
                  className="button ghost-button"
                  to={link}
                  onClick={closeMenuAndScrollToTop}
                >
                  {description}
                </NavLink>
              </div>
            ))}
          </Drawer>
        </nav>
      </div>
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
