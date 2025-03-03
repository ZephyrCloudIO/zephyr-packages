'use client';

import React, { useState } from 'react';
import { useSharedContext } from 'multi-remote-ssr-shared/context';

// Dynamically import remote components
const ContentBlock = React.lazy(() => import('remote-b/ContentBlock'));
const Modal = React.lazy(() => import('remote-c/Modal'));
const Notification = React.lazy(() => import('remote-c/Notification'));

export default function AboutPage() {
  // States for UI components
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{
    title: string;
    content: React.ReactNode;
    size?: 'small' | 'medium' | 'large' | 'fullscreen';
  }>({
    title: '',
    content: null,
  });
  
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const [notificationMessage, setNotificationMessage] = useState('');
  
  // Get shared context from Federation Provider
  const [sharedContext] = useSharedContext();
  
  // Helper function to show a modal
  const showModal = (
    title: string, 
    content: React.ReactNode,
    size: 'small' | 'medium' | 'large' | 'fullscreen' = 'medium'
  ) => {
    setModalContent({ title, content, size });
    setIsModalOpen(true);
  };
  
  // Helper function to show a notification
  const showNotify = (
    type: 'info' | 'success' | 'warning' | 'error',
    message: string
  ) => {
    setNotificationType(type);
    setNotificationMessage(message);
    setShowNotification(true);
    
    setTimeout(() => {
      setShowNotification(false);
    }, 3000);
  };
  
  return (
    <div className={`about-page ${sharedContext.theme}`}>
      <div className="about-header">
        <React.Suspense fallback={<div>Loading content...</div>}>
          <ContentBlock
            id="about-intro"
            title="About Multi-Remote SSR Demo"
            content={
              <div>
                <p>This application demonstrates how multiple federated micro-frontends can work together with server-side rendering.</p>
                <p>It showcases Zephyr's capabilities to integrate components from different sources while maintaining a seamless user experience.</p>
              </div>
            }
            variant="highlighted"
          />
        </React.Suspense>
      </div>
      
      <div className="remote-descriptions">
        <React.Suspense fallback={<div>Loading content...</div>}>
          <ContentBlock
            id="remote-description"
            title="Remote Applications"
            content={
              <div>
                <p>This demonstration includes three remote applications, each providing different functionality:</p>
                
                <div className="remote-card">
                  <h3>Remote A: Navigation and User Interface</h3>
                  <p>Provides the Header, Navigation, and UserProfile components that form the shell of the application.</p>
                  <button className="info-btn" onClick={() => {
                    showModal(
                      'Remote A Details',
                      <div>
                        <p>Remote A is responsible for the core navigation and user interface components:</p>
                        <ul>
                          <li><strong>Header:</strong> The top navigation bar with theme control</li>
                          <li><strong>Navigation:</strong> The sidebar navigation menu</li>
                          <li><strong>UserProfile:</strong> User authentication and profile management</li>
                        </ul>
                        <p>These components work together to provide a consistent interface for the application.</p>
                      </div>,
                      'medium'
                    );
                  }}>View Details</button>
                </div>
                
                <div className="remote-card">
                  <h3>Remote B: Content and Product Management</h3>
                  <p>Provides components for displaying content and product listings.</p>
                  <button className="info-btn" onClick={() => {
                    showModal(
                      'Remote B Details',
                      <div>
                        <p>Remote B focuses on content presentation and e-commerce functionality:</p>
                        <ul>
                          <li><strong>ContentBlock:</strong> Flexible content display with various styles</li>
                          <li><strong>ProductCard:</strong> Individual product display with interactions</li>
                          <li><strong>ProductList:</strong> Product catalog with filtering and sorting</li>
                        </ul>
                        <p>These components are used throughout the application to display products and content.</p>
                      </div>,
                      'large'
                    );
                  }}>View Details</button>
                </div>
                
                <div className="remote-card">
                  <h3>Remote C: UI Utilities</h3>
                  <p>Provides utility components like modals, notifications, and loading indicators.</p>
                  <button className="info-btn" onClick={() => {
                    showModal(
                      'Remote C Details',
                      <div>
                        <p>Remote C provides UI utility components for enhanced user experience:</p>
                        <ul>
                          <li><strong>Modal:</strong> Dialog windows for displaying information</li>
                          <li><strong>Notification:</strong> Toast messages for user feedback</li>
                          <li><strong>Loading:</strong> Various loading indicators and spinners</li>
                        </ul>
                        <p>Try out different notifications below:</p>
                        <div className="notification-buttons">
                          <button className="info-notify" onClick={() => showNotify('info', 'This is an information message')}>Info</button>
                          <button className="success-notify" onClick={() => showNotify('success', 'Operation completed successfully')}>Success</button>
                          <button className="warning-notify" onClick={() => showNotify('warning', 'Warning: This action has consequences')}>Warning</button>
                          <button className="error-notify" onClick={() => showNotify('error', 'Error: Something went wrong')}>Error</button>
                        </div>
                      </div>,
                      'large'
                    );
                  }}>View Details</button>
                </div>
              </div>
            }
            variant="default"
          />
        </React.Suspense>
      </div>
      
      <div className="technical-details">
        <React.Suspense fallback={<div>Loading content...</div>}>
          <ContentBlock
            id="technical-details"
            title="Technical Implementation"
            content={
              <div>
                <p>This demo showcases several key technologies and techniques:</p>
                <ul>
                  <li><strong>Module Federation 2.0:</strong> For sharing components between applications</li>
                  <li><strong>Server-Side Rendering:</strong> Components render on the server for better performance</li>
                  <li><strong>State Sharing:</strong> Using the Federation Context to share state across remotes</li>
                  <li><strong>Hydration:</strong> Seamless transition from server to client rendering</li>
                  <li><strong>Theme Switching:</strong> Cross-remote theme coordination</li>
                </ul>
                <button className="info-btn" onClick={() => {
                  showModal(
                    'SSR Implementation Details',
                    <div>
                      <h3>Server-Side Rendering Implementation</h3>
                      <p>The SSR implementation in this demo follows these key principles:</p>
                      <ol>
                        <li>Server components render the initial state</li>
                        <li>State is serialized and transferred to the client</li>
                        <li>Client-side hydration picks up where the server left off</li>
                        <li>Remote components maintain their state during hydration</li>
                      </ol>
                      <h3>Shared Context</h3>
                      <p>The shared context is implemented using React's Context API and is enhanced with:</p>
                      <ul>
                        <li>Serialization for server-to-client transfer</li>
                        <li>Centralized state management</li>
                        <li>Event dispatch system for cross-remote communication</li>
                      </ul>
                      <h3>Current Context State:</h3>
                      <pre>{JSON.stringify(sharedContext, null, 2)}</pre>
                    </div>,
                    'large'
                  );
                }}>View Technical Details</button>
              </div>
            }
            variant="bordered"
          />
        </React.Suspense>
      </div>
      
      {/* Modal component */}
      {isModalOpen && (
        <React.Suspense fallback={<div>Loading modal...</div>}>
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title={modalContent.title}
            size={modalContent.size}
          >
            {modalContent.content}
          </Modal>
        </React.Suspense>
      )}
      
      {/* Notification component */}
      {showNotification && (
        <React.Suspense fallback={null}>
          <Notification
            type={notificationType}
            message={notificationMessage}
            duration={3000}
            onClose={() => setShowNotification(false)}
          />
        </React.Suspense>
      )}
      
      {/* Styles for the about page */}
      <style jsx>{`
        .about-page {
          transition: background-color 0.3s ease;
          padding: 1rem 0;
        }
        
        .about-page.dark {
          background-color: #333;
          color: #f0f0f0;
        }
        
        .about-header {
          margin-bottom: 2rem;
        }
        
        .remote-descriptions {
          margin-bottom: 2rem;
        }
        
        .remote-card {
          margin-bottom: 1.5rem;
          padding: 1rem;
          border: 1px solid ${sharedContext.theme === 'dark' ? '#666' : '#ddd'};
          border-radius: 4px;
          background-color: ${sharedContext.theme === 'dark' ? '#444' : '#f9f9f9'};
        }
        
        .remote-card h3 {
          margin-bottom: 0.5rem;
          color: var(--primary-color);
        }
        
        .technical-details {
          margin-top: 2rem;
        }
        
        .info-btn {
          background-color: var(--primary-color);
          color: white;
          border: none;
          border-radius: 4px;
          padding: 0.5rem 1rem;
          cursor: pointer;
          font-size: 0.9rem;
          margin-top: 1rem;
          transition: background-color 0.2s ease;
        }
        
        .info-btn:hover {
          background-color: #0051b3;
        }
        
        .notification-buttons {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
        }
        
        .notification-buttons button {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          color: white;
        }
        
        .info-notify {
          background-color: #1890ff;
        }
        
        .success-notify {
          background-color: #52c41a;
        }
        
        .warning-notify {
          background-color: #faad14;
        }
        
        .error-notify {
          background-color: #f5222d;
        }
      `}</style>
    </div>
  );
}