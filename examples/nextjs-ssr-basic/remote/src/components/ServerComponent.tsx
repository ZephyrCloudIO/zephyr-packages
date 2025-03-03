import React from 'react';
import { ServerComponentProps } from 'nextjs-ssr-basic-shared/types';
import Button from './Button';

// This is a Server Component that will be rendered on the server
// and then hydrated on the client
export default function ServerComponent({ id, text }: ServerComponentProps) {
  return (
    <div style={{
      padding: '20px',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      backgroundColor: '#f9f9f9',
      maxWidth: '400px'
    }}>
      <h2 style={{ marginTop: 0, color: '#333' }}>Server Component</h2>
      <p>This component was rendered on the server and hydrated on the client.</p>
      <p>ID: {id}</p>
      <p>Text: {text}</p>
      
      <div style={{ marginTop: '20px' }}>
        <Button 
          id={`${id}_button`}
          text="Server Component Button"
          color="success"
        />
      </div>
      
      <div style={{ 
        marginTop: '20px', 
        fontSize: '12px', 
        color: '#666',
        borderTop: '1px solid #e0e0e0',
        paddingTop: '10px'
      }}>
        <p>This component demonstrates SSR with hydration using the Zephyr package system. The state is persisted between server and client rendering.</p>
      </div>
    </div>
  );
}