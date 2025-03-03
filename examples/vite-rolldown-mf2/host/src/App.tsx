import React, { Suspense } from 'react';
import './App.css';

// Using dynamic import for Module Federation remote component
const RemoteButton = React.lazy(() => import('remote/Button'));

function App() {
  return (
    <div className="container">
      <h1>Vite + Rolldown Module Federation 2.0 Host</h1>
      <p>This example demonstrates Zephyr integration with Vite 6.0 and Rolldown using Module Federation 2.0</p>
      
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
}

export default App;