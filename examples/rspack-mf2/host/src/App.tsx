import React, { Suspense } from 'react';
import './App.css';

// Using React.lazy to load the remote component
const RemoteButton = React.lazy(() => import('remote/Button'));

const App = () => {
  return (
    <div className="container">
      <h1>Rspack Module Federation 2.0 Host</h1>
      <p>This example demonstrates Zephyr integration with Rspack using Module Federation 2.0</p>
      
      <div className="card">
        <h2>Local Component</h2>
        <button className="button">Local Button</button>
      </div>
      
      <div className="card">
        <h2>Remote Component</h2>
        <Suspense fallback={<div>Loading Remote Button...</div>}>
          <RemoteButton />
        </Suspense>
      </div>
    </div>
  );
};

export default App;