import { lazy } from 'react';

const NxWelcome = lazy(() => import('rspack_mf_remote/NxWelcome'));

export function App() {
  return (
    <div>
      <NxWelcome title="! This is loading from Remote!" />
    </div>
  );
}

export default App;
