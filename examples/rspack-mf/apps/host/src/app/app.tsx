import { lazy } from 'react';

const RemoteWelcome = lazy(() => import('rspack_mf_remote/RemoteWelcome'));

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
        <RemoteWelcome title="This is loading from the remote." />
      </div>
    </div>
  );
}

export default App;
