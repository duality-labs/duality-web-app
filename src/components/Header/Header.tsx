import { Link } from 'react-router-dom';

import logo from '../../assets/logo/logo.svg';

export default function Header() {
  return (
    <header className="flex flex-row items-center justify-start w-full text-xl">
      <nav className="w-full p-4 shadow shadow-white/10 text-slate-50">
        <Link className="ml-3" to="/">
          <img src={logo} className="logo h-6 mr-3" alt="logo" />
          <h1 className="inline text-3xl">Duality</h1>
        </Link>
        <Link className="ml-3" to="/swap">
          Swap
        </Link>
        <Link className="ml-3" to="/pool">
          Pool
        </Link>
      </nav>
    </header>
  );
}
