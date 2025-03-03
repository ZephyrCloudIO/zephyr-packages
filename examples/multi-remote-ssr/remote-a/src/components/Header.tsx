'use client';

import React from 'react';
import { 
  useFederation, 
  useRemoteComponent, 
  useSharedContext, 
  createComponentId 
} from 'multi-remote-ssr-shared';
import Navigation from './Navigation';

interface HeaderProps {
  id?: string;
  title?: string;
}

export default function Header({ 
  id = createComponentId('header'),
  title = 'Multi-Remote SSR Demo'
}: HeaderProps) {
  const [state, setState] = useRemoteComponent('remote_a', id, {
    expanded: true,
    notifications: 0,
  });
  
  const [sharedContext, updateSharedContext] = useSharedContext();
  
  // Toggle the expanded state of the header
  const toggleExpanded = () => {
    setState({ expanded: !state.expanded });
  };
  
  // Toggle theme in the shared context
  const toggleTheme = () => {
    const newTheme = sharedContext.theme === 'dark' ? 'light' : 'dark';
    updateSharedContext({ theme: newTheme });
  };

  // Get the current theme or use 'light' as default
  const theme = sharedContext.theme || 'light';
  
  // Styles based on theme
  const styles = {
    header: {
      padding: '20px',
      backgroundColor: theme === 'dark' ? '#333' : '#f0f0f0',
      color: theme === 'dark' ? '#fff' : '#333',
      borderBottom: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
      display: 'flex',
      flexDirection: 'column' as const,
      transition: 'all 0.3s ease',
    },
    headerContent: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      margin: 0,
      fontSize: '24px',
      fontWeight: 'bold',
    },
    controls: {
      display: 'flex',
      gap: '15px',
    },
    button: {
      padding: '8px 12px',
      backgroundColor: theme === 'dark' ? '#555' : '#e0e0e0',
      color: theme === 'dark' ? '#fff' : '#333',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      transition: 'all 0.2s ease',
    },
    expandedContent: {
      marginTop: '15px',
      height: state.expanded ? 'auto' : '0',
      overflow: 'hidden',
      transition: 'height 0.3s ease',
      opacity: state.expanded ? 1 : 0,
    },
    remoteInfo: {
      display: 'inline-block',
      padding: '4px 8px',
      backgroundColor: theme === 'dark' ? '#226644' : '#e6f7f0',
      color: theme === 'dark' ? '#88ffcc' : '#007755',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 'bold',
      marginRight: '10px',
    },
  };
  
  return (
    <header style={styles.header}>
      <div style={styles.headerContent}>
        <h1 style={styles.title}>
          <span style={styles.remoteInfo}>Remote A</span>
          {title}
        </h1>
        
        <div style={styles.controls}>
          <button 
            style={styles.button} 
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
          
          <button 
            style={styles.button} 
            onClick={toggleExpanded}
            aria-label={state.expanded ? 'Collapse header' : 'Expand header'}
          >
            {state.expanded ? '▲ Collapse' : '▼ Expand'}
          </button>
        </div>
      </div>
      
      {/* Expanded content with navigation */}
      <div style={styles.expandedContent}>
        <Navigation id={`${id}_nav`} />
      </div>
      
      {/* This displays hydration status */}
      {state.hydrated && (
        <div style={{
          position: 'absolute',
          top: 5,
          right: 5,
          padding: '2px 6px',
          backgroundColor: '#00aa44',
          color: 'white',
          fontSize: '10px',
          borderRadius: '4px',
        }}>
          ✓ Hydrated from Remote A
        </div>
      )}
    </header>
  );
}