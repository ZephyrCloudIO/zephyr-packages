import React from 'react';

/**
 * RemoteComponent - A component exposed via Module Federation
 * 
 * This demonstrates a component that will be exposed via Module Federation
 * and will carry render type information with it.
 */
const RemoteComponent: React.FC = () => {
  const isSSR = typeof window === 'undefined';
  const renderType = isSSR ? 'ssr' : 'csr';
  
  return (
    <div className="remote-component">
      <h2>Remote Component</h2>
      <p>This component is being rendered using {renderType.toUpperCase()}.</p>
      <p>It is exposed through Module Federation with render type metadata.</p>
    </div>
  );
};

export default RemoteComponent;