import React from 'react';
import './App.css';
import Button from './components/Button';

const App = () => {
  return (
    <div className="container">
      <h1>Rspack Module Federation 2.0 Remote</h1>
      <p>This is the remote application that exposes components to the host.</p>
      
      <div className="card">
        <h2>Exposed Button Component</h2>
        <Button />
      </div>
    </div>
  );
};

export default App;