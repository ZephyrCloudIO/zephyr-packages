import * as React from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import NxWelcome from './nx-welcome';

// @ts-expect-error remote
const Remote = React.lazy(() => import('rspack_nx_mf_remote/Module'));

export function App() {
  return (
    <React.Suspense fallback={null}>
      <ul>
        <li>
          <Link to="/">Home</Link>
        </li>
        <li>
          <Link to="/remote">Remote</Link>
        </li>
      </ul>
      <Routes>
        <Route path="/" element={<NxWelcome title="host" />} />
        <Route path="/remote" element={<Remote />} />
      </Routes>
    </React.Suspense>
  );
}

export default App;
