import React from 'react';
import './Button.css';

const Button = () => {
  return (
    <button className="remote-button" onClick={() => alert('Remote button clicked from Vite + Rolldown!')}>
      Remote Button from Vite + Rolldown
    </button>
  );
};

export default Button;