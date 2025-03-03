import React from 'react';
import { createComponentId } from 'nextjs-ssr-basic-shared/utils';

type SSRRemoteComponentProps = {
  componentName: string;
  componentProps?: Record<string, any>;
};

/**
 * This is a server component that loads a remote component and renders it on the server.
 * 
 * Since this is a server component, it can use async/await directly.
 */
export default async function SSRRemoteLoader({
  componentName,
  componentProps = {}
}: SSRRemoteComponentProps) {
  try {
    // Generate a componentId if one isn't provided in props
    if (!componentProps.id) {
      componentProps.id = createComponentId(componentName.replace('./', ''));
    }
    
    // Import the remote component
    // @ts-ignore - Dynamic import of federated module
    const module = await import(`remote/${componentName}`);
    const Component = module.default;
    
    // We can render the component directly on the server
    return <Component {...componentProps} />;
  } catch (err) {
    // Handle errors gracefully in server component
    console.error(`[SERVER] Error loading remote component "${componentName}":`, err);
    
    return (
      <div style={{ 
        padding: '20px', 
        border: '1px solid #ffcccc', 
        borderRadius: '4px', 
        backgroundColor: '#fff5f5',
        color: '#cc0000'
      }}>
        <h3>Error Loading Remote Component (Server)</h3>
        <p>The server could not load the component: {componentName}</p>
        <pre style={{ 
          whiteSpace: 'pre-wrap', 
          wordBreak: 'break-all',
          fontSize: '12px',
          backgroundColor: '#ffeeee',
          padding: '10px',
          borderRadius: '4px'
        }}>
          {err instanceof Error ? err.message : String(err)}
        </pre>
      </div>
    );
  }
}