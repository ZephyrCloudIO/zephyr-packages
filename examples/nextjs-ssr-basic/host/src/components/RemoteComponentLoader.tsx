'use client';

import React, { useEffect, useState } from 'react';
import { createComponentId } from 'nextjs-ssr-basic-shared/utils';

interface RemoteComponentLoaderProps {
  componentName: string;
  fallback?: React.ReactNode;
  componentProps?: Record<string, any>;
}

export default function RemoteComponentLoader({
  componentName,
  fallback = <div>Loading remote component...</div>,
  componentProps = {}
}: RemoteComponentLoaderProps) {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Generate a componentId if one isn't provided in props
    if (!componentProps.id) {
      componentProps.id = createComponentId(componentName.replace('./', ''));
    }
    
    // Import the remote component
    const importComponent = async () => {
      try {
        // @ts-ignore - Dynamic import of federated module
        const module = await import(`remote/${componentName}`);
        setComponent(() => module.default);
        setLoading(false);
      } catch (err) {
        console.error(`Error loading remote component "${componentName}":`, err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    };
    
    importComponent();
  }, [componentName, componentProps]);
  
  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        border: '1px solid #ffcccc', 
        borderRadius: '4px', 
        backgroundColor: '#fff5f5',
        color: '#cc0000'
      }}>
        <h3>Error Loading Remote Component</h3>
        <p>Could not load the component: {componentName}</p>
        <pre style={{ 
          whiteSpace: 'pre-wrap', 
          wordBreak: 'break-all',
          fontSize: '12px',
          backgroundColor: '#ffeeee',
          padding: '10px',
          borderRadius: '4px'
        }}>
          {error.message}
        </pre>
      </div>
    );
  }
  
  if (loading || !Component) {
    return <>{fallback}</>;
  }
  
  return <Component {...componentProps} />;
}