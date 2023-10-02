import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, LinkProps, useResolvedPath, useMatch } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { useThemeMode } from '../../lib/themeProvider';

import Drawer from '../Drawer';
import logoWithText from '../../assets/logo/logo-with-text-white.svg';
import './Header.scss';

const { REACT_APP__DEFAULT_PAIR = '' } = process.env;

const keplrLogoURI =
  'https://raw.githubusercontent.com/chainapsis/keplr-wallet/master/docs/.vuepress/public/favicon-256.png';

const pageLinkMap = {
  [['/swap', REACT_APP__DEFAULT_PAIR].join('/')]: 'Swap',
  '/pools': 'Pools',
  [['/orderbook', REACT_APP__DEFAULT_PAIR].join('/')]: 'Orderbook',
  '/portfolio': 'Portfolio',
  '/bridge': 'Bridge',
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

  // close the secondary menu if a click is from outside of the header
  const headerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(event: Event) {
      if (event.target && !headerRef.current?.contains(event.target as Node)) {
        setMenuIsOpen(false);
      }
    }
    // Bind the event listener to document
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keyup', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keyup', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
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
      ref={headerRef}
      className={[(pageIsScrolled || menuIsOpen) && 'scrolled']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="container py-5">
        <nav className="row gap-4">
          <div className="col">
            <NavLink
              className="logo"
              to={['/swap', REACT_APP__DEFAULT_PAIR].join('/')}
              onClick={closeMenuAndScrollToTop}
            >
              <h1 className="font-brand">
                <img
                  src={logoWithText}
                  alt="Duality"
                  width="198"
                  height="63"
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
                  <Link to="/portfolio" className="button user-profile">
                    <img src={keplrLogoURI} className="logo mr-3" alt="logo" />
                    <div className="text-truncate">{address}</div>
                  </Link>
                ) : (
                  <button
                    className="connect-wallet button-dark"
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
  // match only first path part for "active" class
  const match = useMatch({
    path: `/${resolved.pathname.split('/').at(1)}/*`,
    end: true,
  });
  const activeClassName = match ? 'active' : '';
  const fullClassName = [className, activeClassName].filter(Boolean).join(' ');

  return (
    <Link to={to} className={fullClassName} {...otherProps}>
      {children}
    </Link>
  );
}
