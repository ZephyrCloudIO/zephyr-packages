import * as React from 'react';
import NxWelcome from './nx-welcome';
import { Link, Route, Routes } from 'react-router-dom';

const Remote1 = React.lazy(() => import('remote1/Module'));

export function App() {
  return (
    <React.Suspense fallback={null}>
      <ul>
        <li>
          <Link to="/">Home</Link>
        </li>
        <li>
          <Link to="/remote1">Remote1</Link>
        </li>
      </ul>
      <Routes>
        <Route path="/" element={<NxWelcome title="@webpack-mf/shell" />} />
        <Route path="/remote1" element={<Remote1 />} />
      </Routes>
    </React.Suspense>
  );
}

export default App;
