import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import HostWelcome from './host-welcome';

const Remote = lazy(() => import('rspack_nx_mf_remote/Module'));

export function App() {
  return (
    <Suspense fallback={null}>
      <ul>
        <li>
          <Link to="/">Home</Link>
        </li>
        <li>
          <Link to="/remote">Remote</Link>
        </li>
      </ul>
      <Routes>
        <Route path="/" element={<HostWelcome />} />
        <Route path="/remote" element={<Remote />} />
      </Routes>
    </Suspense>
  );
}

export default App;
