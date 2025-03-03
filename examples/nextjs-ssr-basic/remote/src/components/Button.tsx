'use client';

import React, { useState, useEffect } from 'react';
import { createComponentId, getComponentState, updateComponentState } from 'nextjs-ssr-basic-shared/utils';

interface ButtonProps {
  id?: string;
  text?: string;
  onClick?: () => void;
  color?: 'primary' | 'secondary' | 'success' | 'danger';
}

// Define common styles
const styles = {
  button: {
    padding: '10px 15px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    transition: 'background-color 0.3s',
  },
  colors: {
    primary: {
      backgroundColor: '#3498db',
      color: 'white',
      hoverColor: '#2980b9',
    },
    secondary: {
      backgroundColor: '#95a5a6',
      color: 'white',
      hoverColor: '#7f8c8d',
    },
    success: {
      backgroundColor: '#2ecc71',
      color: 'white',
      hoverColor: '#27ae60',
    },
    danger: {
      backgroundColor: '#e74c3c',
      color: 'white',
      hoverColor: '#c0392b',
    },
  },
};

export default function Button({ 
  id: propId,
  text = 'Click Me', 
  onClick,
  color = 'primary'
}: ButtonProps) {
  // Generate a unique component ID if not provided
  const [componentId] = useState(propId || createComponentId('button'));
  const [clickCount, setClickCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  
  // Try to get initial state from SSR store
  useEffect(() => {
    const state = getComponentState('nextjs-ssr-basic-remote', componentId);
    if (state) {
      setClickCount(state.clickCount || 0);
      setHydrated(true);
    } else {
      // Initialize state in the store
      updateComponentState('nextjs-ssr-basic-remote', componentId, {
        id: componentId,
        text,
        hydrated: true,
        clickCount: 0
      });
      setHydrated(true);
    }
  }, [componentId, text]);
  
  const handleClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    
    // Update state in the store
    updateComponentState('nextjs-ssr-basic-remote', componentId, {
      clickCount: newCount
    });
    
    // Call the provided onClick handler if it exists
    if (onClick) {
      onClick();
    }
  };
  
  // Define button style based on color prop
  const buttonColor = styles.colors[color];
  const buttonStyle = {
    ...styles.button,
    backgroundColor: buttonColor.backgroundColor,
    color: buttonColor.color,
  };
  
  const hoverStyle = {
    ...buttonStyle,
    backgroundColor: buttonColor.hoverColor,
  };
  
  // Define a hover state for styling
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={handleClick}
        style={isHovered ? hoverStyle : buttonStyle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {text} ({clickCount})
      </button>
      {hydrated && (
        <div style={{ 
          position: 'absolute', 
          top: -18, 
          right: -5, 
          fontSize: '10px', 
          color: '#00cc00', 
          backgroundColor: '#f0f0f0', 
          padding: '2px 4px', 
          borderRadius: '2px' 
        }}>
          ✓ Hydrated
        </div>
      )}
    </div>
  );
}