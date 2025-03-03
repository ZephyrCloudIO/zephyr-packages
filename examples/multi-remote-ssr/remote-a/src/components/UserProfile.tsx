'use client';

import React from 'react';
import { 
  useRemoteComponent, 
  useSharedContext,
  createComponentId 
} from 'multi-remote-ssr-shared';

interface UserProfileProps {
  id?: string;
  username?: string;
  avatar?: string;
}

export default function UserProfile({ 
  id = createComponentId('userProfile'),
  username = 'Guest User',
  avatar = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'
}: UserProfileProps) {
  const [state, setState] = useRemoteComponent('remote_a', id, {
    username,
    avatar,
    isLoggedIn: false,
  });
  
  const [sharedContext, updateSharedContext] = useSharedContext();
  const theme = sharedContext.theme || 'light';
  
  const toggleLogin = () => {
    const newLoginState = !state.isLoggedIn;
    setState({ isLoggedIn: newLoginState });
    
    if (newLoginState) {
      // Update shared context with user info
      updateSharedContext({
        userId: 'user123',
        permissions: ['read', 'comment'],
        preferences: {
          notifications: true,
          emailUpdates: false
        }
      });
    } else {
      // Clear user info from shared context
      updateSharedContext({
        userId: undefined,
        permissions: [],
        preferences: {}
      });
    }
  };
  
  // Styles based on theme
  const styles = {
    profile: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px',
      backgroundColor: theme === 'dark' ? '#444' : '#fff',
      border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
      borderRadius: '8px',
      color: theme === 'dark' ? '#fff' : '#333',
      maxWidth: '300px',
    },
    avatar: {
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      objectFit: 'cover' as const,
      border: `2px solid ${state.isLoggedIn ? '#4CAF50' : '#ccc'}`,
    },
    info: {
      display: 'flex',
      flexDirection: 'column' as const,
      flex: 1,
    },
    username: {
      fontWeight: 'bold',
      margin: 0,
    },
    status: {
      fontSize: '12px',
      color: state.isLoggedIn 
        ? (theme === 'dark' ? '#8AFF8A' : '#4CAF50') 
        : (theme === 'dark' ? '#999' : '#777'),
    },
    button: {
      padding: '6px 10px',
      backgroundColor: state.isLoggedIn 
        ? (theme === 'dark' ? '#C33' : '#F44336') 
        : (theme === 'dark' ? '#3C3' : '#4CAF50'),
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
    },
    statusBadge: {
      position: 'absolute' as const,
      top: -5,
      right: -5,
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      backgroundColor: state.isLoggedIn ? '#4CAF50' : '#999',
      border: `2px solid ${theme === 'dark' ? '#444' : '#fff'}`,
    },
    avatarWrapper: {
      position: 'relative' as const,
    },
  };
  
  return (
    <div style={styles.profile}>
      <div style={styles.avatarWrapper}>
        <img 
          src={state.avatar} 
          alt={`${state.username}'s avatar`} 
          style={styles.avatar} 
        />
        <div style={styles.statusBadge}></div>
      </div>
      
      <div style={styles.info}>
        <h3 style={styles.username}>{state.username}</h3>
        <span style={styles.status}>
          {state.isLoggedIn ? 'Logged In' : 'Logged Out'}
        </span>
      </div>
      
      <button 
        style={styles.button} 
        onClick={toggleLogin}
      >
        {state.isLoggedIn ? 'Logout' : 'Login'}
      </button>
      
      {/* This displays hydration status */}
      {state.hydrated && (
        <div style={{
          position: 'absolute',
          top: -8,
          right: -8,
          padding: '2px 6px',
          backgroundColor: '#00aa44',
          color: 'white',
          fontSize: '10px',
          borderRadius: '4px',
        }}>
          ✓ Hydrated
        </div>
      )}
    </div>
  );
}