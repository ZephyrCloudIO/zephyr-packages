import React from 'react';
import Header from '../components/Header';
import UserProfile from '../components/UserProfile';

export default function Home() {
  return (
    <main style={{
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <Header id="header" title="Remote A Standalone Page" />
      
      <div style={{ padding: '20px' }}>
        <h2>Remote A</h2>
        <p>
          This is Remote A's standalone page. It exposes Header, Navigation, and UserProfile 
          components that can be consumed by other applications.
        </p>
        
        <div style={{ 
          marginTop: '20px',
          padding: '20px',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          border: '1px solid #eaeaea'
        }}>
          <h3>Exposed Components</h3>
          <p>This remote exposes the following components:</p>
          
          <ul>
            <li><strong>Header</strong> - The top navigation header with theme switching</li>
            <li><strong>Navigation</strong> - Navigation menu (used within Header)</li>
            <li><strong>UserProfile</strong> - User profile component shown below</li>
          </ul>
          
          <div style={{ marginTop: '20px' }}>
            <h4>User Profile Component Example:</h4>
            <UserProfile id="userProfileExample" username="John Doe" />
          </div>
        </div>
        
        <div style={{ 
          marginTop: '20px',
          padding: '20px',
          backgroundColor: '#f0f7ff',
          borderRadius: '8px',
          border: '1px solid #d0e0ff'
        }}>
          <h3>Federation Information</h3>
          <ul>
            <li><strong>Remote Name:</strong> remote_a</li>
            <li><strong>Version:</strong> 0.1.0</li>
            <li><strong>Type:</strong> header components</li>
            <li><strong>Capabilities:</strong> SSR, theming, i18n</li>
            <li><strong>Dependencies:</strong> Consumes components from Remote C</li>
          </ul>
        </div>
      </div>
    </main>
  );
}