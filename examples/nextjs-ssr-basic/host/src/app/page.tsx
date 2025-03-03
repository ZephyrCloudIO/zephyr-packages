import React from 'react';
import SSRRemoteLoader from '../components/SSRRemoteLoader';
import ClientButtonDemo from './client-components';

export default function Home() {
  return (
    <main style={{ 
      padding: '40px', 
      maxWidth: '800px', 
      margin: '0 auto',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <h1>Next.js SSR Host with Zephyr</h1>
      <p style={{ fontSize: '18px', lineHeight: '1.6', color: '#555' }}>
        This application demonstrates Server-Side Rendering with Module Federation and Zephyr. 
        Remote components are rendered on the server and hydrated on the client, with state maintained between the two environments.
      </p>
      
      <div style={{ 
        marginTop: '30px',
        display: 'flex',
        flexDirection: 'column',
        gap: '30px'
      }}>
        {/* Server Components Section */}
        <section style={{
          padding: '25px',
          borderRadius: '8px',
          backgroundColor: '#f9f9ff',
          border: '1px solid #e0e0ff'
        }}>
          <h2 style={{ marginTop: 0 }}>Server-Rendered Components</h2>
          <p>
            These components are loaded and rendered on the server using Next.js App Router.
            The Zephyr system manages the state transfer from server to client.
          </p>
          
          <div style={{ marginTop: '20px' }}>
            {/* This component is loaded and rendered on the server */}
            <SSRRemoteLoader 
              componentName="./ServerComponent" 
              componentProps={{
                id: "ssr-server-component",
                text: "This component was rendered on the server by the host application"
              }}
            />
          </div>
          
          <div style={{ marginTop: '20px' }}>
            {/* Another server-rendered component */}
            <SSRRemoteLoader 
              componentName="./Button" 
              componentProps={{
                id: "server-rendered-button",
                text: "Server Rendered Button",
                color: "primary"
              }}
            />
          </div>
        </section>
        
        {/* Client Components Section */}
        <section style={{
          padding: '25px',
          borderRadius: '8px',
          backgroundColor: '#f9fff9',
          border: '1px solid #e0ffe0'
        }}>
          <h2 style={{ marginTop: 0 }}>Client-Side Components</h2>
          <p>
            These components are loaded and rendered on the client. They demonstrate
            the client-side capabilities of Module Federation with Zephyr.
          </p>
          
          <ClientButtonDemo />
        </section>
      </div>
      
      <div style={{ 
        marginTop: '40px',
        padding: '20px',
        backgroundColor: '#fef8ff',
        borderRadius: '8px',
        border: '1px solid #f0e0ff'
      }}>
        <h2>How It Works</h2>
        <ul style={{ lineHeight: '1.6' }}>
          <li><strong>Server Components:</strong> Rendered on the server and hydrated on the client</li>
          <li><strong>State Management:</strong> Initial state generated on the server and passed to the client</li>
          <li><strong>Hydration:</strong> Components pick up their state on the client and continue functioning</li>
          <li><strong>Fallbacks:</strong> If primary URLs fail, the system tries alternative paths</li>
          <li><strong>Version Control:</strong> Specific versions of remotes can be requested</li>
        </ul>
        <p>
          The Zephyr system coordinates all of this complexity behind the scenes,
          making it simple to develop applications with federated components.
        </p>
      </div>
    </main>
  );
}