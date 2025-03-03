import React from 'react';
import ServerComponent from '../components/ServerComponent';
import Button from '../components/Button';

export default function Home() {
  return (
    <main style={{ 
      padding: '40px', 
      maxWidth: '800px', 
      margin: '0 auto',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <h1>Nextjs SSR Remote</h1>
      <p>This is a demonstration of a Next.js application with Server-Side Rendering and Module Federation.</p>
      
      <div style={{ marginTop: '40px' }}>
        <h2>Exposed Components</h2>
        <p>The following components are exposed and can be consumed by other applications:</p>
        
        <div style={{ 
          display: 'flex', 
          gap: '20px', 
          flexDirection: 'column',
          marginTop: '20px'
        }}>
          <div>
            <h3>Button Component</h3>
            <p>A client component that can be customized and tracks its state.</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <Button text="Primary Button" color="primary" />
              <Button text="Secondary Button" color="secondary" />
              <Button text="Success Button" color="success" />
              <Button text="Danger Button" color="danger" />
            </div>
          </div>
          
          <div style={{ marginTop: '20px' }}>
            <h3>Server Component</h3>
            <p>A server component that is rendered on the server and hydrated on the client.</p>
            <ServerComponent 
              id="example-server-component" 
              text="This is a server-rendered component."
            />
          </div>
        </div>
      </div>
      
      <div style={{ 
        marginTop: '40px',
        padding: '20px',
        backgroundColor: '#f0f7ff',
        borderRadius: '8px',
        border: '1px solid #d0e0ff'
      }}>
        <h2>Module Federation Configuration</h2>
        <p>This application exposes the following modules:</p>
        <ul>
          <li><code>./Button</code> - A client component with state</li>
          <li><code>./ServerComponent</code> - A server component with hydration</li>
        </ul>
        <p>The remote entry is available at: <code>/static/chunks/remoteEntry.js</code></p>
      </div>
    </main>
  );
}