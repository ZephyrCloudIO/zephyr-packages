import React, { useState, useEffect } from 'react';
import RemoteComponent from './RemoteComponent';

const App: React.FC = () => {
  const [isServer, setIsServer] = useState<boolean>(false);
  const [remoteTypes, setRemoteTypes] = useState<{ renderType: string; framework: string }>({ 
    renderType: 'unknown', 
    framework: 'unknown' 
  });
  const [manifestContent, setManifestContent] = useState<string>('Loading...');
  
  useEffect(() => {
    // Check if running on server or client
    setIsServer(typeof window === 'undefined');
    
    // Get remote types from global variable
    if (typeof window !== 'undefined' && window.__REMOTE_TYPES_DETECTION__) {
      setRemoteTypes(window.__REMOTE_TYPES_DETECTION__);
    }
    
    // Try to fetch the manifest file
    fetch('./remote-types-manifest.json')
      .then(response => response.json())
      .then(data => {
        setManifestContent(JSON.stringify(data, null, 2));
      })
      .catch(error => {
        console.error('Error loading manifest:', error);
        setManifestContent(`Error loading manifest: ${error.message}`);
      });
  }, []);
  
  return (
    <div className="container">
      <h1>
        Remote Types Detection
        <span className={`badge badge-${remoteTypes.renderType}`}>
          {remoteTypes.renderType.toUpperCase()}
        </span>
      </h1>
      <p>Webpack Example</p>
      
      <div className="card">
        <h2>Detected Information</h2>
        <div className="info">
          <p><strong>Render Type:</strong> {remoteTypes.renderType}</p>
          <p><strong>Framework:</strong> {remoteTypes.framework}</p>
          <p><strong>Running on:</strong> {isServer ? 'Server' : 'Client'}</p>
        </div>
      </div>
      
      <RemoteComponent />
      
      <div className="card">
        <h2>Manifest Content</h2>
        <pre>{manifestContent}</pre>
      </div>
      
      <div className="card">
        <h2>Module Federation</h2>
        <p>This application exposes a RemoteComponent with appropriate render type metadata:</p>
        <pre>
{`new ModuleFederationPlugin({
  name: 'remoteTypesApp',
  filename: 'remoteEntry.js',
  exposes: {
    './RemoteComponent': './src/RemoteComponent.tsx'
  },
  // The render type is automatically added by the Remote Types Plugin
  renderType: '${remoteTypes.renderType}'
})`}
        </pre>
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
npm run start

# SSR Build 
npm run start:ssr

# Build both
npm run build && npm run build:ssr`}
        </pre>
      </div>
    </div>
  );
};

export default App;