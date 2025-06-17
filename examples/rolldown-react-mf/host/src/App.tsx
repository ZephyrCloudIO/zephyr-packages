import { lazy, Suspense } from 'react';

// @ts-expect-error - Remote module
const RemoteButton = lazy(() => import('rolldown-remote/Button'));

function App() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Rolldown Module Federation Host</h1>
      <p>This is the host application using Rolldown bundler.</p>
      
      <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '10px' }}>
        <h2>Remote Component:</h2>
        <Suspense fallback={<div>Loading remote button...</div>}>
          <RemoteButton />
        </Suspense>
      </div>
    </div>
  );
}

export default App;