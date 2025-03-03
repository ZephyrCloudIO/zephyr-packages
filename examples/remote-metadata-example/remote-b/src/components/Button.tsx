import React from 'react';
import './Button.css';

/**
 * Button Component from Remote B
 * 
 * This component demonstrates a client-side rendered (CSR) component
 * from a Vite application that can be federated to other applications.
 */
interface ButtonProps {
  text: string;
  onClick: () => void;
}

const Button: React.FC<ButtonProps> = ({ text, onClick }) => {
  return (
    <div className="button-container">
      <button className="csr-button" onClick={onClick}>
        {text}
      </button>
      <div className="button-info">
        <p><strong>Rendering:</strong> Client-Side (CSR)</p>
        <p><strong>Framework:</strong> Vite + React</p>
        <p><strong>Remote:</strong> B</p>
      </div>
    </div>
  );
};

export default Button;