import { Link } from 'react-router-dom';

import logo from '../../assets/logo/logo.svg';

import './Header.scss';

export default function Header() {
  return (
    <header className="flex flex-row content-center justify-start">
      <nav>
        <Link to="/">
          <img src={logo} className="logo" alt="logo" />
          <h1>Duality</h1>
        </Link>
        <Link to="/swap">Swap</Link>
        <Link to="/pool">Pool</Link>
      </nav>
    </header>
  );
}
