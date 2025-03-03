import React, { ReactNode } from 'react';
import './Card.css';

/**
 * Card Component from Remote C
 * 
 * This component demonstrates a component from a Webpack application
 * that can be federated to other applications with metadata sharing.
 */
interface CardProps {
  title: string;
  children: ReactNode;
}

const Card: React.FC<CardProps> = ({ title, children }) => {
  return (
    <div className="card-container">
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
      </div>
      <div className="card-content">
        {children}
      </div>
      <div className="card-footer">
        <div className="card-info">
          <p><strong>Framework:</strong> Webpack + React</p>
          <p><strong>Remote:</strong> C</p>
          <p><strong>Created:</strong> {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
};

export default Card;