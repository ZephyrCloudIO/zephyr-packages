'use client';

import React, { useState } from 'react';
import Notification from '../components/Notification';
import Modal from '../components/Modal';
import Loading, { LoadingType } from '../components/Loading';
import { useSharedContext } from 'multi-remote-ssr-shared';

export default function Home() {
  // State for examples
  const [notificationType, setNotificationType] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const [notificationVisible, setNotificationVisible] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingType, setLoadingType] = useState<LoadingType>('spinner');
  
  // Get shared context (like theme)
  const [sharedContext, updateSharedContext] = useSharedContext();
  const theme = sharedContext.theme || 'light';
  
  // Toggle theme
  const toggleTheme = () => {
    updateSharedContext({
      theme: theme === 'dark' ? 'light' : 'dark'
    });
  };
  
  // Show a new notification
  const showNotification = (type: 'info' | 'success' | 'warning' | 'error') => {
    setNotificationType(type);
    setNotificationVisible(true);
  };
  
  // Common button style
  const buttonStyle = {
    padding: '8px 16px',
    margin: '0 8px 8px 0',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: theme === 'dark' ? '#3b82f6' : '#2563eb',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
  };
  
  // Page styles
  const styles = {
    container: {
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: theme === 'dark' ? '#e2e8f0' : '#1a202c',
      backgroundColor: theme === 'dark' ? '#1a202c' : '#f9fafb',
      minHeight: '100vh',
    },
    section: {
      marginBottom: '40px',
      padding: '20px',
      backgroundColor: theme === 'dark' ? '#2d3748' : 'white',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      marginBottom: '20px',
      borderBottom: `1px solid ${theme === 'dark' ? '#4a5568' : '#e2e8f0'}`,
      paddingBottom: '10px',
    },
    buttonGroup: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '8px',
      marginBottom: '20px',
    },
    infoBox: {
      padding: '12px',
      backgroundColor: theme === 'dark' ? '#2d3748' : '#f0f9ff',
      borderRadius: '4px',
      marginBottom: '20px',
      border: `1px solid ${theme === 'dark' ? '#4a5568' : '#e0f2fe'}`,
    },
    loadingContainer: {
      border: `1px solid ${theme === 'dark' ? '#4a5568' : '#e2e8f0'}`,
      padding: '30px',
      borderRadius: '8px',
      display: 'flex',
      justifyContent: 'center',
      marginTop: '20px',
    },
    themeButton: {
      position: 'fixed' as const,
      top: '20px',
      right: '20px',
      padding: '8px 16px',
      borderRadius: '4px',
      border: 'none',
      backgroundColor: theme === 'dark' ? '#e2e8f0' : '#1a202c',
      color: theme === 'dark' ? '#1a202c' : '#e2e8f0',
      cursor: 'pointer',
      fontSize: '14px',
    },
  };
  
  return (
    <div style={styles.container}>
      <button 
        style={styles.themeButton}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
      </button>
      
      <h1>Remote C - UI Utilities</h1>
      <p>This remote provides common UI utility components for notifications, modals, and loading indicators.</p>
      
      {/* Notification Section */}
      <section style={styles.section}>
        <h2 style={styles.title}>Notification Component</h2>
        <div style={styles.infoBox}>
          <p>Notifications are used to provide feedback to users about actions or system events.</p>
        </div>
        
        <div style={styles.buttonGroup}>
          <button 
            style={buttonStyle} 
            onClick={() => showNotification('info')}
          >
            Show Info
          </button>
          <button 
            style={buttonStyle} 
            onClick={() => showNotification('success')}
          >
            Show Success
          </button>
          <button 
            style={buttonStyle} 
            onClick={() => showNotification('warning')}
          >
            Show Warning
          </button>
          <button 
            style={buttonStyle} 
            onClick={() => showNotification('error')}
          >
            Show Error
          </button>
        </div>
        
        {notificationVisible && (
          <Notification
            id="notification_demo"
            type={notificationType}
            title={`${notificationType.charAt(0).toUpperCase() + notificationType.slice(1)} Notification`}
            message={`This is a ${notificationType} notification message from Remote C.`}
            autoClose={false}
            onClose={() => setNotificationVisible(false)}
          />
        )}
      </section>
      
      {/* Modal Section */}
      <section style={styles.section}>
        <h2 style={styles.title}>Modal Component</h2>
        <div style={styles.infoBox}>
          <p>Modals are used to display content in a layer above the app, requiring user interaction.</p>
        </div>
        
        <button 
          style={buttonStyle} 
          onClick={() => setModalOpen(true)}
        >
          Open Modal
        </button>
        
        <Modal
          id="modal_demo"
          isOpen={modalOpen}
          title="Example Modal"
          onClose={() => setModalOpen(false)}
        >
          <div>
            <p>This is a modal dialog from Remote C.</p>
            <p>It demonstrates cross-remote state management and animations.</p>
            <div style={{ marginTop: '20px' }}>
              <button
                style={buttonStyle}
                onClick={() => setModalOpen(false)}
              >
                Close Modal
              </button>
            </div>
          </div>
        </Modal>
      </section>
      
      {/* Loading Section */}
      <section style={styles.section}>
        <h2 style={styles.title}>Loading Component</h2>
        <div style={styles.infoBox}>
          <p>Loading indicators inform users that content is being processed or loaded.</p>
        </div>
        
        <div style={styles.buttonGroup}>
          <button 
            style={buttonStyle} 
            onClick={() => setLoadingType('spinner')}
          >
            Spinner
          </button>
          <button 
            style={buttonStyle} 
            onClick={() => setLoadingType('dots')}
          >
            Dots
          </button>
          <button 
            style={buttonStyle} 
            onClick={() => setLoadingType('pulse')}
          >
            Pulse
          </button>
          <button 
            style={buttonStyle} 
            onClick={() => setLoadingType('skeleton')}
          >
            Skeleton
          </button>
        </div>
        
        <div style={styles.loadingContainer}>
          <Loading
            id="loading_demo"
            type={loadingType}
            text={`${loadingType.charAt(0).toUpperCase() + loadingType.slice(1)} Loading...`}
          />
        </div>
      </section>
      
      {/* Federation Info */}
      <section style={{
        marginTop: '30px',
        padding: '20px',
        backgroundColor: theme === 'dark' ? '#2d3748' : '#f0f7ff',
        borderRadius: '8px',
        border: `1px solid ${theme === 'dark' ? '#4a5568' : '#d0e0ff'}`
      }}>
        <h3>Federation Information</h3>
        <ul>
          <li><strong>Remote Name:</strong> remote_c</li>
          <li><strong>Version:</strong> 0.1.0</li>
          <li><strong>Type:</strong> utility components</li>
          <li><strong>Capabilities:</strong> SSR, animation, i18n</li>
          <li><strong>Exposed Components:</strong> Notification, Modal, Loading</li>
        </ul>
      </section>
      
      {/* Default notification that's always visible */}
      <Notification
        id="notification_info"
        type="info"
        title="Utility Remote Info"
        message="This is Remote C providing utility components. All components are SSR-compatible and theme-aware."
        autoClose={false}
      />
    </div>
  );
}