import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import HostView from './pages/HostView';
import PlayerView from './pages/PlayerView';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/host" element={<HostView />} />
      <Route path="/play" element={<PlayerView />} />
    </Routes>
  );
}

export default App;
