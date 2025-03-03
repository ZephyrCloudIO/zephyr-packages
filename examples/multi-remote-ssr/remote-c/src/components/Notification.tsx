'use client';

import React, { useEffect } from 'react';
import { 
  useRemoteComponent, 
  useSharedContext,
  createComponentId 
} from 'multi-remote-ssr-shared';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface NotificationProps {
  id?: string;
  type?: NotificationType;
  title?: string;
  message: string;
  autoClose?: boolean;
  duration?: number;
  showIcon?: boolean;
  onClose?: () => void;
}

export default function Notification({
  id = createComponentId('notification'),
  type = 'info',
  title,
  message,
  autoClose = true,
  duration = 5000,
  showIcon = true,
  onClose
}: NotificationProps) {
  // Use the remote component state management
  const [state, setState] = useRemoteComponent('remote_c', id, {
    visible: true,
    closing: false,
  });
  
  // Get shared context (like theme)
  const [sharedContext] = useSharedContext();
  const theme = sharedContext.theme || 'light';
  
  // Auto-close effect
  useEffect(() => {
    let closeTimer: NodeJS.Timeout;
    
    if (autoClose && state.visible && !state.closing) {
      closeTimer = setTimeout(() => {
        handleClose();
      }, duration);
    }
    
    return () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
      }
    };
  }, [autoClose, duration, state.visible, state.closing]);
  
  // Close notification
  const handleClose = () => {
    setState({ closing: true });
    
    // After animation, set visible to false
    setTimeout(() => {
      setState({ visible: false });
      if (onClose) {
        onClose();
      }
    }, 300);
  };
  
  // Don't render if not visible
  if (!state.visible) {
    return null;
  }
  
  // Get colors based on notification type and theme
  const getColors = () => {
    if (theme === 'dark') {
      switch (type) {
        case 'success':
          return { bg: '#1e462a', border: '#2e844a', icon: '#4caf50', text: '#a7f3d0' };
        case 'warning':
          return { bg: '#533f04', border: '#b45309', icon: '#f59e0b', text: '#fde68a' };
        case 'error':
          return { bg: '#5c1c1c', border: '#dc2626', icon: '#ef4444', text: '#fecaca' };
        case 'info':
        default:
          return { bg: '#1e3b8a', border: '#3b82f6', icon: '#60a5fa', text: '#bfdbfe' };
      }
    } else {
      switch (type) {
        case 'success':
          return { bg: '#ecfdf5', border: '#10b981', icon: '#10b981', text: '#064e3b' };
        case 'warning':
          return { bg: '#fffbeb', border: '#f59e0b', icon: '#f59e0b', text: '#78350f' };
        case 'error':
          return { bg: '#fef2f2', border: '#ef4444', icon: '#ef4444', text: '#7f1d1d' };
        case 'info':
        default:
          return { bg: '#eff6ff', border: '#3b82f6', icon: '#3b82f6', text: '#1e3a8a' };
      }
    }
  };
  
  const colors = getColors();
  
  // Get icon based on notification type
  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'warning':
        return '⚠';
      case 'error':
        return '✕';
      case 'info':
      default:
        return 'ℹ';
    }
  };
  
  // Animation style for closing
  const getAnimationStyle = () => {
    if (state.closing) {
      return {
        opacity: 0,
        transform: 'translateX(100%)',
        transition: 'opacity 300ms, transform 300ms',
      };
    }
    return {
      opacity: 1,
      transform: 'translateX(0)',
      transition: 'opacity 300ms, transform 300ms',
    };
  };
  
  // Styles based on theme and type
  const styles = {
    notification: {
      display: 'flex',
      padding: '12px 16px',
      borderRadius: '6px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      marginBottom: '16px',
      backgroundColor: colors.bg,
      borderLeft: `4px solid ${colors.border}`,
      color: colors.text,
      width: '100%',
      maxWidth: '400px',
      position: 'relative' as const,
      ...getAnimationStyle(),
    },
    icon: {
      flexShrink: 0,
      marginRight: '12px',
      fontSize: '20px',
      color: colors.icon,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
    },
    title: {
      fontWeight: 'bold',
      marginBottom: '4px',
      fontSize: '16px',
    },
    message: {
      fontSize: '14px',
      lineHeight: 1.5,
    },
    closeButton: {
      background: 'transparent',
      border: 'none',
      color: theme === 'dark' ? '#a0aec0' : '#4a5568',
      cursor: 'pointer',
      padding: '4px',
      borderRadius: '4px',
      marginLeft: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '18px',
      alignSelf: 'flex-start',
    },
    hydrationBadge: {
      position: 'absolute' as const,
      top: -5,
      right: -5,
      padding: '2px 6px',
      backgroundColor: '#00aa44',
      color: 'white',
      fontSize: '10px',
      borderRadius: '4px',
      zIndex: 10,
    },
  };
  
  return (
    <div style={styles.notification} role="alert">
      {state.hydrated && (
        <div style={styles.hydrationBadge}>✓ Hydrated</div>
      )}
      
      {showIcon && (
        <div style={styles.icon}>
          {getIcon()}
        </div>
      )}
      
      <div style={styles.content}>
        {title && <div style={styles.title}>{title}</div>}
        <div style={styles.message}>{message}</div>
      </div>
      
      <button 
        style={styles.closeButton}
        onClick={handleClose}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}