import logo from './logo.svg';
import './App.scss';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Swap from './pages/Swap';
import Pool from './pages/Pool';

function App() {
  return (
    <BrowserRouter>
      <header>
        <img src={logo} className="logo" alt="logo" />
        <p>Duality</p>
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
