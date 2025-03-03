'use client';

import React from 'react';

interface LoadingFallbackProps {
  message?: string;
  type?: 'spinner' | 'skeleton' | 'dots';
}

const LoadingFallback: React.FC<LoadingFallbackProps> = ({
  message = 'Loading...',
  type = 'spinner',
}) => {
  return (
    <div className="loading-fallback">
      {type === 'spinner' && (
        <div className="spinner">
          <div className="spinner-inner"></div>
        </div>
      )}
      
      {type === 'dots' && (
        <div className="dots">
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>
      )}
      
      {type === 'skeleton' && (
        <div className="skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-body">
            <div className="skeleton-line"></div>
            <div className="skeleton-line"></div>
            <div className="skeleton-line"></div>
          </div>
        </div>
      )}
      
      {message && <p className="loading-message">{message}</p>}
      
      <style jsx>{`
        .loading-fallback {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          text-align: center;
          min-height: 200px;
        }
        
        .loading-message {
          margin-top: 20px;
          font-size: 16px;
          color: var(--color-text-light);
        }
        
        /* Spinner type */
        .spinner {
          width: 50px;
          height: 50px;
          position: relative;
        }
        
        .spinner-inner {
          box-sizing: border-box;
          display: block;
          position: absolute;
          width: 40px;
          height: 40px;
          margin: 5px;
          border: 4px solid transparent;
          border-radius: 50%;
          border-top-color: var(--color-primary);
          animation: spin 1s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        }
        
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        
        /* Dots type */
        .dots {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        
        .dot {
          width: 12px;
          height: 12px;
          background-color: var(--color-primary);
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }
        
        .dot:nth-child(1) {
          animation-delay: -0.32s;
        }
        
        .dot:nth-child(2) {
          animation-delay: -0.16s;
        }
        
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }
        
        /* Skeleton type */
        .skeleton {
          width: 100%;
          max-width: 400px;
        }
        
        .skeleton-header {
          height: 30px;
          background: linear-gradient(90deg, 
            var(--color-background-alt) 25%, 
            rgba(0, 0, 0, 0.05) 50%, 
            var(--color-background-alt) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
          border-radius: var(--border-radius);
          margin-bottom: 20px;
        }
        
        .skeleton-body {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        
        .skeleton-line {
          height: 15px;
          background: linear-gradient(90deg, 
            var(--color-background-alt) 25%, 
            rgba(0, 0, 0, 0.05) 50%, 
            var(--color-background-alt) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
          border-radius: var(--border-radius);
        }
        
        .skeleton-line:nth-child(1) {
          width: 100%;
        }
        
        .skeleton-line:nth-child(2) {
          width: 85%;
        }
        
        .skeleton-line:nth-child(3) {
          width: 65%;
        }
        
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingFallback;