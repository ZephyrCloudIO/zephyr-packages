import React, { useEffect, useState } from 'react';

// Import the baseHref functionality
declare global {
  interface Window {
    __BASEHREF__: string;
  }
}

const App: React.FC = () => {
  const [detectedBase, setDetectedBase] = useState<string>('');
  const [manifestContent, setManifestContent] = useState<string>('Loading...');
  
  useEffect(() => {
    // Detect base path at runtime
    const runtimeBase = window.__BASEHREF__ || '/';
    setDetectedBase(runtimeBase);
    
    // Try to load the manifest file
    fetch('./basehref-manifest.json')
      .then(response => response.json())
      .then(data => {
        setManifestContent(JSON.stringify(data, null, 2));
      })
      .catch(error => {
        setManifestContent(`Error loading manifest: ${error.message}`);
      });
  }, []);
  
  // Create paths to test with different configurations
  const imagePaths = {
    relative: './assets/image.jpg',
    absolute: '/assets/image.jpg',
    baseHref: new URL('assets/image.jpg', detectedBase).href
  };

  return (
    <div className="container">
      <h1>BaseHref Webpack Example</h1>
      
      <div className="card">
        <h2>Configuration Info</h2>
        <p><strong>Detected Base (window.__BASEHREF__):</strong></p>
        <p className="resource-path">{detectedBase}</p>
        
        <h3>Manifest Content:</h3>
        <pre className="resource-path" style={{ whiteSpace: 'pre-wrap' }}>
          {manifestContent}
        </pre>
      </div>
      
      <div className="card">
        <h2>Path Resolution Examples</h2>
        
        <div>
          <h3>Relative Path</h3>
          <p className="resource-path">{imagePaths.relative}</p>
          <p>Resolves to:</p>
          <p className="resource-path">{new URL(imagePaths.relative, window.location.href).href}</p>
        </div>
        
        <div>
          <h3>Absolute Path</h3>
          <p className="resource-path">{imagePaths.absolute}</p>
          <p>Resolves to:</p>
          <p className="resource-path">{new URL(imagePaths.absolute, window.location.origin).href}</p>
        </div>
        
        <div>
          <h3>BaseHref Path</h3>
          <p className="resource-path">new URL('assets/image.jpg', window.__BASEHREF__)</p>
          <p>Resolves to:</p>
          <p className="resource-path">{imagePaths.baseHref}</p>
        </div>
      </div>
      
      <div className="card">
        <h2>Navigation</h2>
        <div className="row">
          <a href="./">Home</a>
          <a href="./about">About</a>
          <a href="./products">Products</a>
        </div>
      </div>
      
      <footer>
        <p>This example demonstrates the BaseHref functionality in a Webpack application.</p>
        <p>Try running with different public paths using:</p>
        <p className="resource-path">npm run start:base</p>
      </footer>
    </div>
  );
};

export default App;