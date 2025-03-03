import React from 'react';

interface SimpleComponentProps {
  /**
   * The text to display
   */
  text?: string;
  
  /**
   * Optional onClick handler
   */
  onClick?: () => void;
  
  /**
   * Optional className
   */
  className?: string;
}

/**
 * A simple component for testing SSR
 */
export function SimpleComponent({
  text = 'Hello, World!',
  onClick,
  className = '',
}: SimpleComponentProps) {
  const [count, setCount] = React.useState(0);
  
  const handleClick = () => {
    setCount((prev) => prev + 1);
    if (onClick) {
      onClick();
    }
  };
  
  return (
    <div 
      className={`simple-component ${className}`}
      data-testid="simple-component"
    >
      <h2>{text}</h2>
      <p>Count: {count}</p>
      <button onClick={handleClick}>Increment</button>
    </div>
  );
}

export default SimpleComponent;