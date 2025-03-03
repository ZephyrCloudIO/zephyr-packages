import React from 'react';
import './Button.css';

const Button = () => {
  return (
    <button className="remote-button" onClick={() => alert('Remote button clicked!')}>
      Remote Button from MF 2.0
    </button>
  );
};

export default Button;