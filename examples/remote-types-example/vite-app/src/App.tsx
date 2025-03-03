import React, { useState, useEffect } from 'react';
import remoteTypes from 'virtual:remote-types';

function App() {
  const [isServer, setIsServer] = useState<boolean>(false);
  const [manifestContents, setManifestContents] = useState<string>('Loading...');
  
  useEffect(() => {
    // Check if running on server or client
    setIsServer(typeof window === 'undefined');
    
    // Try to fetch the manifest file
    fetch('./remote-types-manifest.json')
      .then(response => response.json())
      .then(data => {
        setManifestContents(JSON.stringify(data, null, 2));
      })
      .catch(error => {
        console.error('Error loading manifest:', error);
        setManifestContents(`Error loading manifest: ${error.message}`);
      });
  }, []);

  return (
    <div className="container">
      <h1>Remote Types Detection</h1>
      <p>Vite Example</p>
      
      <div className="card">
        <h2>Detected Information</h2>
        <div className="info">
          <p><strong>Render Type:</strong> {remoteTypes.renderType}</p>
          <p><strong>Framework:</strong> {remoteTypes.framework}</p>
          {remoteTypes.frameworkVersion && (
            <p><strong>Framework Version:</strong> {remoteTypes.frameworkVersion}</p>
          )}
          <p><strong>Running on:</strong> {isServer ? 'Server' : 'Client'}</p>
        </div>
      </div>
      
      <div className="card">
        <h2>Manifest Content</h2>
        <pre>{manifestContents}</pre>
      </div>
      
      <div className="card">
        <h2>Build Modes</h2>
        <p>This example demonstrates two build configurations:</p>
        <ol>
          <li><strong>Default (CSR)</strong>: Standard client-side rendering</li>
          <li><strong>SSR</strong>: Server-side rendering configuration</li>
        </ol>
        
        <div className="buttons">
          <button onClick={() => window.location.reload()}>Reload Page</button>
          <a href="https://github.com/your-repo/remote-types-example" target="_blank" rel="noopener noreferrer">
            View Source
          </a>
        </div>
      </div>
      
      <div className="card">
        <h2>Usage</h2>
        <p>Run one of the following commands:</p>
        <pre>
{`# CSR Build
npm run dev

# SSR Build 
npm run dev:ssr

# Build both
npm run build && npm run build:ssr`}
        </pre>
      </div>
    </div>
  );
}

export default App;