'use client';

import React from 'react';
import { 
  useRemoteComponent, 
  useSharedContext,
  createComponentId 
} from 'multi-remote-ssr-shared';

export interface ContentBlockData {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  callToAction?: {
    text: string;
    url: string;
  };
  variant?: 'default' | 'highlight' | 'featured';
}

interface ContentBlockProps {
  id?: string;
  data: ContentBlockData;
}

export default function ContentBlock({ 
  id = createComponentId('content'),
  data
}: ContentBlockProps) {
  // Use the remote component state management
  const [state, setState] = useRemoteComponent('remote_b', id, {
    expanded: false,
    hasInteracted: false,
  });
  
  // Get shared context (like theme)
  const [sharedContext] = useSharedContext();
  const theme = sharedContext.theme || 'light';
  
  // Toggle expanded state
  const toggleExpanded = () => {
    setState({ 
      expanded: !state.expanded,
      hasInteracted: true 
    });
  };
  
  // Set background color based on variant and theme
  const getBackgroundColor = () => {
    if (theme === 'dark') {
      switch (data.variant) {
        case 'highlight': return '#2d3748';
        case 'featured': return '#2c3e50';
        default: return '#1a202c';
      }
    } else {
      switch (data.variant) {
        case 'highlight': return '#ebf8ff';
        case 'featured': return '#e6fffa';
        default: return '#ffffff';
      }
    }
  };
  
  // Set border color based on variant and theme
  const getBorderColor = () => {
    if (theme === 'dark') {
      switch (data.variant) {
        case 'highlight': return '#4299e1';
        case 'featured': return '#38b2ac';
        default: return '#2d3748';
      }
    } else {
      switch (data.variant) {
        case 'highlight': return '#90cdf4';
        case 'featured': return '#81e6d9';
        default: return '#e2e8f0';
      }
    }
  };
  
  // Styles based on theme
  const styles = {
    container: {
      padding: '24px',
      borderRadius: '8px',
      backgroundColor: getBackgroundColor(),
      color: theme === 'dark' ? '#e2e8f0' : '#1a202c',
      border: `1px solid ${getBorderColor()}`,
      position: 'relative' as const,
      overflow: 'hidden',
    },
    title: {
      fontSize: '20px',
      fontWeight: 'bold',
      marginTop: 0,
      marginBottom: '12px',
      color: theme === 'dark' ? '#ffffff' : '#000000',
    },
    content: {
      fontSize: '16px',
      lineHeight: 1.6,
      marginBottom: '16px',
      maxHeight: state.expanded ? 'none' : '100px',
      overflow: state.expanded ? 'visible' : 'hidden',
      position: 'relative' as const,
    },
    contentGradient: {
      display: (!state.expanded && data.content.length > 300) ? 'block' : 'none',
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      height: '40px',
      background: `linear-gradient(to bottom, transparent, ${getBackgroundColor()})`,
    },
    buttonRow: {
      display: 'flex',
      justifyContent: data.callToAction ? 'space-between' : 'flex-end',
      alignItems: 'center',
      marginTop: '16px',
    },
    expandButton: {
      fontSize: '14px',
      color: theme === 'dark' ? '#a0aec0' : '#4a5568',
      backgroundColor: 'transparent',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '4px 8px',
      borderRadius: '4px',
      '&:hover': {
        backgroundColor: theme === 'dark' ? '#2d3748' : '#edf2f7',
      },
    },
    ctaButton: {
      fontSize: '14px',
      fontWeight: 'bold',
      padding: '8px 16px',
      borderRadius: '4px',
      backgroundColor: theme === 'dark' ? '#4299e1' : '#3182ce',
      color: 'white',
      border: 'none',
      cursor: 'pointer',
      textDecoration: 'none',
      display: 'inline-block',
    },
    imageContainer: {
      width: '100%',
      height: '200px',
      borderRadius: '4px',
      overflow: 'hidden',
      marginBottom: '16px',
    },
    image: {
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
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
    remoteInfo: {
      display: 'inline-block',
      padding: '4px 8px',
      backgroundColor: theme === 'dark' ? '#443366' : '#f0e6ff',
      color: theme === 'dark' ? '#bb99ff' : '#6200ea',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 'bold',
      marginRight: '10px',
    },
    titleRow: {
      display: 'flex',
      alignItems: 'center',
    },
  };
  
  // Only show expand/collapse button if content is long
  const showExpandButton = data.content.length > 300;
  
  return (
    <div style={styles.container}>
      {state.hydrated && (
        <div style={styles.hydrationBadge}>✓ Hydrated</div>
      )}
      
      <div style={styles.titleRow}>
        <span style={styles.remoteInfo}>Remote B</span>
        <h3 style={styles.title}>{data.title}</h3>
      </div>
      
      {data.imageUrl && (
        <div style={styles.imageContainer}>
          <img 
            src={data.imageUrl} 
            alt={data.title}
            style={styles.image}
          />
        </div>
      )}
      
      <div style={styles.content}>
        {data.content}
        {!state.expanded && data.content.length > 300 && (
          <div style={styles.contentGradient}></div>
        )}
      </div>
      
      <div style={styles.buttonRow}>
        {data.callToAction && (
          <a 
            href={data.callToAction.url}
            style={styles.ctaButton}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setState({ hasInteracted: true })}
          >
            {data.callToAction.text}
          </a>
        )}
        
        {showExpandButton && (
          <button 
            style={styles.expandButton}
            onClick={toggleExpanded}
          >
            {state.expanded ? 'Collapse ▲' : 'Read More ▼'}
          </button>
        )}
      </div>
    </div>
  );
}