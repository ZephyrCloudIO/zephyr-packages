import { lazy } from 'react';

const NxWelcome = lazy(() => import('rspack_mf_remote/NxWelcome'));

export function App() {
  return (
    <div>
      <p>
        <strong>Host ZE_PUBLIC_HELLO: </strong>
        {process.env.ZE_PUBLIC_HELLO}
      </p>
      <p>
        <strong>Host ZE_PUBLIC_SAME: </strong>
        {process.env.ZE_PUBLIC_SAME}
      </p>
      <div>
        <h2>Remote Application</h2>
        <NxWelcome title="! This is loading from Remote!" />
      </div>
    </div>
  );
}

export default App;
