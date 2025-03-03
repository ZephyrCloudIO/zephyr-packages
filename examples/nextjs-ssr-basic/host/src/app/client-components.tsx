'use client';

import React, { useState } from 'react';
import RemoteComponentLoader from '../components/RemoteComponentLoader';

export default function ClientButtonDemo() {
  const [activeButtons, setActiveButtons] = useState<Record<string, boolean>>({
    button1: true,
    button2: false,
    button3: false
  });
  
  const toggleButton = (buttonId: string) => {
    setActiveButtons(prev => ({
      ...prev,
      [buttonId]: !prev[buttonId]
    }));
  };
  
  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => toggleButton('button1')}
          style={{ 
            padding: '8px 12px', 
            backgroundColor: activeButtons.button1 ? '#2ecc71' : '#f0f0f0',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            color: activeButtons.button1 ? 'white' : 'black'
          }}
        >
          Primary Button
        </button>
        
        <button 
          onClick={() => toggleButton('button2')}
          style={{ 
            padding: '8px 12px', 
            backgroundColor: activeButtons.button2 ? '#3498db' : '#f0f0f0',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            color: activeButtons.button2 ? 'white' : 'black'
          }}
        >
          Secondary Button
        </button>
        
        <button 
          onClick={() => toggleButton('button3')}
          style={{ 
            padding: '8px 12px', 
            backgroundColor: activeButtons.button3 ? '#e74c3c' : '#f0f0f0',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            color: activeButtons.button3 ? 'white' : 'black'
          }}
        >
          Danger Button
        </button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {activeButtons.button1 && (
          <div>
            <h3>Primary Remote Button</h3>
            <RemoteComponentLoader 
              componentName="./Button" 
              componentProps={{
                id: "client-primary-button",
                text: "Primary Client Button",
                color: "primary"
              }}
              fallback={<div>Loading primary button...</div>}
            />
          </div>
        )}
        
        {activeButtons.button2 && (
          <div>
            <h3>Secondary Remote Button</h3>
            <RemoteComponentLoader 
              componentName="./Button" 
              componentProps={{
                id: "client-secondary-button",
                text: "Secondary Client Button",
                color: "secondary"
              }}
              fallback={<div>Loading secondary button...</div>}
            />
          </div>
        )}
        
        {activeButtons.button3 && (
          <div>
            <h3>Danger Remote Button</h3>
            <RemoteComponentLoader 
              componentName="./Button" 
              componentProps={{
                id: "client-danger-button",
                text: "Danger Client Button",
                color: "danger"
              }}
              fallback={<div>Loading danger button...</div>}
            />
          </div>
        )}
      </div>
    </div>
  );
}