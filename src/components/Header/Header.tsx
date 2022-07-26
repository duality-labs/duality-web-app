import { Link } from 'react-router-dom';

import { useWeb3 } from '../../lib/web3/useWeb3';

import logo from '../../assets/logo/logo.svg';

export default function Header() {
  const { connectWallet, address } = useWeb3();

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
          <span>{address}</span>
        ) : (
          <button onClick={onConnectClick}>Connect Wallet</button>
        )}
      </nav>
    </header>
  );
}
