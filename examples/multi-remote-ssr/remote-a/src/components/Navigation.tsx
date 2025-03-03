'use client';

import React from 'react';
import { 
  useRemoteComponent, 
  useSharedContext,
  createComponentId 
} from 'multi-remote-ssr-shared';

interface NavigationProps {
  id?: string;
}

export default function Navigation({ id = createComponentId('navigation') }: NavigationProps) {
  const [state, setState] = useRemoteComponent('remote_a', id, {
    activeItem: 'home'
  });
  
  const [sharedContext] = useSharedContext();
  const theme = sharedContext.theme || 'light';
  
  const handleNavClick = (item: string) => {
    setState({ activeItem: item });
    
    // Here we would normally handle navigation, but for the demo we just update state
  };
  
  // Navigation items
  const navItems = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'products', label: 'Products', icon: '🛒' },
    { id: 'about', label: 'About', icon: 'ℹ️' },
    { id: 'contact', label: 'Contact', icon: '✉️' },
  ];
  
  // Styles based on theme
  const styles = {
    nav: {
      display: 'flex',
      gap: '10px',
      marginTop: '10px'
    },
    navItem: (active: boolean) => ({
      padding: '10px 15px',
      backgroundColor: active 
        ? (theme === 'dark' ? '#555' : '#e0e0e0') 
        : 'transparent',
      color: theme === 'dark' ? '#fff' : '#333',
      borderRadius: '4px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      transition: 'all 0.2s ease',
      border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
      fontWeight: active ? 'bold' : 'normal'
    }),
    icon: {
      fontSize: '18px',
    }
  };
  
  return (
    <nav style={styles.nav}>
      {navItems.map(item => (
        <div
          key={item.id}
          style={styles.navItem(state.activeItem === item.id)}
          onClick={() => handleNavClick(item.id)}
          role="button"
          tabIndex={0}
          aria-selected={state.activeItem === item.id}
        >
          <span style={styles.icon}>{item.icon}</span>
          {item.label}
        </div>
      ))}
      
      {/* This displays hydration status */}
      {state.hydrated && (
        <div style={{
          marginLeft: 'auto',
          padding: '2px 6px',
          backgroundColor: '#00aa44',
          color: 'white',
          fontSize: '10px',
          borderRadius: '4px',
          alignSelf: 'center'
        }}>
          ✓ Nav Hydrated
        </div>
      )}
    </nav>
  );
}