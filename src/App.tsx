import logo from './logo.svg';
import './App.scss';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Swap from './pages/Swap';
import Pool from './pages/Pool';

function App() {
  return (
    <div className="App">
      <header>
        <img src={logo} className="logo" alt="logo" />
        <p>Duality</p>
      </header>
      <main>
        <BrowserRouter>
          <Routes>
            <Route index element={<div>Home</div>} />
            <Route path="swap" element={<Swap />} />
            <Route path="pool" element={<Pool />} />
            <Route path="*" element={<div>Not found</div>} />
          </Routes>
        </BrowserRouter>
      </main>
    </div>
  );
}

export default App;
