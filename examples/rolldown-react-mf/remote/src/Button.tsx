import { useState } from 'react';

const Button = () => {
  const [count, setCount] = useState(0);
  
  return (
    <div style={{ 
      border: '2px solid #007acc', 
      borderRadius: '8px', 
      padding: '20px', 
      margin: '10px 0',
      backgroundColor: '#f0f8ff'
    }}>
      <h3>Remote Button Component</h3>
      <p>This button is served from the Rolldown remote application.</p>
      <button 
        onClick={() => setCount((count) => count + 1)}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: '#007acc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Count is {count}
      </button>
      <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
        Click the button to increment the counter!
      </p>
    </div>
  );
};

export default Button;