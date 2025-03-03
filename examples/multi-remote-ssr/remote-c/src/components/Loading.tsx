'use client';

import React, { useEffect } from 'react';
import { 
  useRemoteComponent, 
  useSharedContext,
  createComponentId 
} from 'multi-remote-ssr-shared';

export type LoadingType = 'spinner' | 'dots' | 'pulse' | 'skeleton';
export type LoadingSize = 'small' | 'medium' | 'large';

interface LoadingProps {
  id?: string;
  type?: LoadingType;
  size?: LoadingSize;
  text?: string;
  fullScreen?: boolean;
  color?: string;
  overlay?: boolean;
}

export default function Loading({
  id = createComponentId('loading'),
  type = 'spinner',
  size = 'medium',
  text,
  fullScreen = false,
  color,
  overlay = false
}: LoadingProps) {
  // Use the remote component state management
  const [state, setState] = useRemoteComponent('remote_c', id, {
    visible: true,
    progress: 0
  });
  
  // Get shared context (like theme)
  const [sharedContext] = useSharedContext();
  const theme = sharedContext.theme || 'light';
  
  // Auto-increment progress for a more realistic loader
  useEffect(() => {
    if (state.progress < 90 && state.visible) {
      const timer = setTimeout(() => {
        const increment = Math.floor(Math.random() * 5) + 1; // Random increment between 1-5%
        setState({ progress: Math.min(90, state.progress + increment) });
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [state.progress, state.visible]);
  
  if (!state.visible) {
    return null;
  }
  
  // Get default color based on theme
  const getDefaultColor = () => {
    return theme === 'dark' ? '#60a5fa' : '#3b82f6';
  };
  
  // Get size dimensions
  const getSizeDimension = () => {
    switch (size) {
      case 'small': return { size: 24, text: '12px' };
      case 'medium': return { size: 40, text: '14px' };
      case 'large': return { size: 60, text: '16px' };
      default: return { size: 40, text: '14px' };
    }
  };
  
  const sizeDim = getSizeDimension();
  const loadingColor = color || getDefaultColor();
  
  // Styles based on theme and props
  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      position: fullScreen ? 'fixed' : 'relative' as const,
      top: fullScreen ? 0 : undefined,
      left: fullScreen ? 0 : undefined,
      right: fullScreen ? 0 : undefined,
      bottom: fullScreen ? 0 : undefined,
      backgroundColor: overlay 
        ? (theme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)') 
        : 'transparent',
      zIndex: fullScreen ? 9999 : undefined,
      padding: '20px',
      boxSizing: 'border-box' as const,
      gap: '15px',
    },
    text: {
      color: theme === 'dark' ? '#e2e8f0' : '#1a202c',
      fontSize: sizeDim.text,
      marginTop: '10px',
      textAlign: 'center' as const,
    },
    progress: {
      width: '100%',
      maxWidth: '300px',
      height: '4px',
      backgroundColor: theme === 'dark' ? '#2d3748' : '#e2e8f0',
      borderRadius: '2px',
      overflow: 'hidden',
      marginTop: '8px',
    },
    progressBar: {
      height: '100%',
      width: `${state.progress}%`,
      backgroundColor: loadingColor,
      transition: 'width 0.3s ease',
    },
    spinner: {
      width: `${sizeDim.size}px`,
      height: `${sizeDim.size}px`,
      border: `${Math.max(2, sizeDim.size / 10)}px solid ${theme === 'dark' ? '#2d3748' : '#e2e8f0'}`,
      borderTopColor: loadingColor,
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    },
    dots: {
      display: 'flex',
      gap: `${Math.max(4, sizeDim.size / 6)}px`,
    },
    dot: {
      width: `${Math.max(6, sizeDim.size / 4)}px`,
      height: `${Math.max(6, sizeDim.size / 4)}px`,
      backgroundColor: loadingColor,
      borderRadius: '50%',
      animation: 'pulse 1.5s infinite ease-in-out',
    },
    pulse: {
      width: `${sizeDim.size}px`,
      height: `${sizeDim.size}px`,
      backgroundColor: loadingColor,
      borderRadius: '50%',
      opacity: 0.6,
      animation: 'pulse-animation 1.5s infinite',
    },
    skeleton: {
      width: '100%',
      maxWidth: '300px',
      height: `${Math.max(15, sizeDim.size / 2)}px`,
      backgroundColor: theme === 'dark' ? '#2d3748' : '#e2e8f0',
      borderRadius: '4px',
      overflow: 'hidden',
      position: 'relative' as const,
    },
    skeletonShimmer: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: `linear-gradient(90deg, 
        transparent, 
        ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.8)'}, 
        transparent)`,
      animation: 'shimmer 2s infinite',
    },
    hydrationBadge: {
      position: 'absolute' as const,
      top: 5,
      right: 5,
      padding: '2px 6px',
      backgroundColor: '#00aa44',
      color: 'white',
      fontSize: '10px',
      borderRadius: '4px',
      zIndex: 10,
    },
    keyframes: `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      @keyframes pulse {
        0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
        40% { transform: scale(1); opacity: 1; }
      }
      
      @keyframes pulse-animation {
        0% { transform: scale(0.8); opacity: 0.5; }
        50% { transform: scale(1.2); opacity: 0.8; }
        100% { transform: scale(0.8); opacity: 0.5; }
      }
      
      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
    `,
  };
  
  // Render the loading indicator based on type
  const renderLoader = () => {
    switch (type) {
      case 'spinner':
        return <div style={styles.spinner}></div>;
        
      case 'dots':
        return (
          <div style={styles.dots}>
            <div style={{ ...styles.dot, animationDelay: '0s' }}></div>
            <div style={{ ...styles.dot, animationDelay: '0.2s' }}></div>
            <div style={{ ...styles.dot, animationDelay: '0.4s' }}></div>
          </div>
        );
        
      case 'pulse':
        return <div style={styles.pulse}></div>;
        
      case 'skeleton':
        return (
          <div style={styles.skeleton}>
            <div style={styles.skeletonShimmer}></div>
          </div>
        );
        
      default:
        return <div style={styles.spinner}></div>;
    }
  };
  
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles.keyframes }} />
      <div style={styles.container} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.progress}>
        {state.hydrated && (
          <div style={styles.hydrationBadge}>✓ Hydrated</div>
        )}
        
        {renderLoader()}
        
        {text && <div style={styles.text}>{text}</div>}
        
        {type !== 'skeleton' && (
          <div style={styles.progress}>
            <div style={styles.progressBar}></div>
          </div>
        )}
      </div>
    </>
  );
}