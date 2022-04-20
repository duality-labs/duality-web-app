import logo from './logo.svg';
import './App.scss';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Swap from './pages/Swap';
import Pool from './pages/Pool';

function App() {
  return (
    <BrowserRouter>
      <header>
        <nav>
          <Link to="/">
            <img src={logo} className="logo" alt="logo" />
            <h1>Duality</h1>
          </Link>
          <Link to="/swap">Swap</Link>
          <Link to="/pool">Pool</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route index element={<div>Home</div>} />
          <Route path="swap" element={<Swap />} />
          <Route path="pool" element={<Pool />} />
          <Route path="*" element={<div>Not found</div>} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
