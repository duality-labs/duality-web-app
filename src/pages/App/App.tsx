import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Header from '../../components/Header';
import Swap from '../Swap';
import Pool from '../Pool';

import './App.scss';

function App() {
  return (
    <BrowserRouter>
      <Header />
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
