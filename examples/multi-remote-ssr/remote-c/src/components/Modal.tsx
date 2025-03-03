'use client';

import React, { useEffect } from 'react';
import { 
  useRemoteComponent, 
  useSharedContext,
  createComponentId 
} from 'multi-remote-ssr-shared';

interface ModalProps {
  id?: string;
  isOpen?: boolean;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  size?: 'small' | 'medium' | 'large';
  showCloseButton?: boolean;
  closeOnEsc?: boolean;
  closeOnOverlayClick?: boolean;
}

export default function Modal({
  id = createComponentId('modal'),
  isOpen = false,
  title,
  children,
  onClose,
  size = 'medium',
  showCloseButton = true,
  closeOnEsc = true,
  closeOnOverlayClick = true
}: ModalProps) {
  // Use the remote component state management
  const [state, setState] = useRemoteComponent('remote_c', id, {
    isOpen,
    fadeIn: false,
    fadeOut: false
  });
  
  // Get shared context (like theme)
  const [sharedContext] = useSharedContext();
  const theme = sharedContext.theme || 'light';
  
  // Handle opening and closing
  useEffect(() => {
    if (isOpen && !state.isOpen) {
      setState({ isOpen: true, fadeIn: true, fadeOut: false });
      
      // Add event listener for Escape key
      if (closeOnEsc) {
        const handleEsc = (event: KeyboardEvent) => {
          if (event.key === 'Escape') {
            handleClose();
          }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
      }
    } else if (!isOpen && state.isOpen) {
      handleClose();
    }
  }, [isOpen, state.isOpen, closeOnEsc]);
  
  // If the modal isn't open, don't render anything
  if (!state.isOpen) {
    return null;
  }
  
  // Handle closing the modal
  const handleClose = () => {
    setState({ fadeOut: true, fadeIn: false });
    
    // Wait for animation to complete before actually closing
    setTimeout(() => {
      setState({ isOpen: false, fadeOut: false });
      if (onClose) {
        onClose();
      }
    }, 300);
  };
  
  // Handle overlay click
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      handleClose();
    }
  };
  
  // Get width based on size
  const getWidth = () => {
    switch (size) {
      case 'small': return '400px';
      case 'medium': return '600px';
      case 'large': return '800px';
      default: return '600px';
    }
  };
  
  // Get animation style
  const getAnimationStyle = () => {
    if (state.fadeIn) {
      return {
        opacity: 1,
        transform: 'translateY(0)',
        transition: 'opacity 300ms, transform 300ms',
      };
    }
    if (state.fadeOut) {
      return {
        opacity: 0,
        transform: 'translateY(-20px)',
        transition: 'opacity 300ms, transform 300ms',
      };
    }
    return { opacity: 0, transform: 'translateY(-20px)' };
  };
  
  // Styles based on theme
  const styles = {
    overlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      opacity: state.fadeIn ? 1 : 0,
      transition: 'opacity 300ms',
    },
    modal: {
      backgroundColor: theme === 'dark' ? '#1a202c' : 'white',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
      width: getWidth(),
      maxWidth: '90%',
      maxHeight: '90vh',
      display: 'flex',
      flexDirection: 'column' as const,
      ...getAnimationStyle(),
    },
    header: {
      padding: '16px 24px',
      borderBottom: `1px solid ${theme === 'dark' ? '#2d3748' : '#e2e8f0'}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      margin: 0,
      fontSize: '18px',
      fontWeight: 'bold',
      color: theme === 'dark' ? 'white' : '#1a202c',
    },
    closeButton: {
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      fontSize: '24px',
      color: theme === 'dark' ? '#a0aec0' : '#718096',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4px',
      borderRadius: '4px',
      lineHeight: 1,
    },
    content: {
      padding: '24px',
      overflow: 'auto',
      color: theme === 'dark' ? '#e2e8f0' : '#1a202c',
    },
    hydrationBadge: {
      position: 'absolute' as const,
      top: 8,
      right: 8,
      padding: '2px 6px',
      backgroundColor: '#00aa44',
      color: 'white',
      fontSize: '10px',
      borderRadius: '4px',
      zIndex: 10,
    },
  };
  
  return (
    <div 
      style={styles.overlay} 
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? `${id}-title` : undefined}
    >
      <div style={styles.modal}>
        {state.hydrated && (
          <div style={styles.hydrationBadge}>✓ Hydrated</div>
        )}
        
        {(title || showCloseButton) && (
          <div style={styles.header}>
            {title && (
              <h2 id={`${id}-title`} style={styles.title}>{title}</h2>
            )}
            {showCloseButton && (
              <button 
                style={styles.closeButton} 
                onClick={handleClose}
                aria-label="Close modal"
              >
                ×
              </button>
            )}
          </div>
        )}
        
        <div style={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
}