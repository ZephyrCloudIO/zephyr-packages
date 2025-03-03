import React, { Suspense } from 'react';
import { StreamingPriority } from 'streaming-ssr-shared/dist/types';

interface StreamingLayoutProps {
  children: React.ReactNode;
  critical?: boolean;
  priority?: StreamingPriority;
  title?: string;
  showDiagnostics?: boolean;
  delay?: number; // For demo purposes
}

function LoadingIndicator() {
  return (
    <div className="streaming-layout-loading">
      <div className="streaming-layout-loader"></div>
      <div className="streaming-layout-text">Streaming content...</div>
      <style jsx>{`
        .streaming-layout-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          background-color: #f5f5f5;
          border-radius: 8px;
          text-align: center;
        }
        
        .streaming-layout-loader {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 3px solid rgba(0, 0, 0, 0.1);
          border-top-color: #3498db;
          animation: spin 1s infinite linear;
          margin-bottom: 16px;
        }
        
        .streaming-layout-text {
          color: #666;
          font-size: 16px;
        }
        
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * A layout component designed for streaming content with priority
 * 
 * This component creates a container for streamed content with:
 * - Priority-based streaming
 * - Critical path prioritization
 * - Optional diagnostics for timing
 * - Integrated suspense boundaries
 */
export default function StreamingLayout({
  children,
  critical = false,
  priority = 'medium',
  title,
  showDiagnostics = false,
  delay
}: StreamingLayoutProps) {
  // Demo artificial delay
  React.useEffect(() => {
    if (delay && typeof window !== 'undefined') {
      const timer = setTimeout(() => {
        // This is just to trigger a re-render after the delay
        // In a real app, this would be unnecessary as the server would stream content
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [delay]);

  // Demo diagnostic info
  const [renderTime, setRenderTime] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (showDiagnostics && typeof window !== 'undefined') {
      const endTime = performance.now();
      const startTime = window.__streamingStartTime || endTime;
      setRenderTime(endTime - startTime);
    }
  }, [showDiagnostics]);

  return (
    <section className={`streaming-layout ${critical ? 'critical' : ''} priority-${priority}`}>
      {title && <h2 className="streaming-layout-title">{title}</h2>}
      
      <div className="streaming-layout-content">
        <Suspense fallback={<LoadingIndicator />}>
          {children}
        </Suspense>
      </div>
      
      {showDiagnostics && renderTime !== null && (
        <div className="streaming-layout-diagnostics">
          <div className="diagnostic-item">
            <span className="diagnostic-label">Priority:</span>
            <span className={`diagnostic-value priority-${priority}`}>{priority}</span>
          </div>
          <div className="diagnostic-item">
            <span className="diagnostic-label">Critical Path:</span>
            <span className="diagnostic-value">{critical ? 'Yes' : 'No'}</span>
          </div>
          <div className="diagnostic-item">
            <span className="diagnostic-label">Render Time:</span>
            <span className="diagnostic-value">{renderTime.toFixed(2)}ms</span>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .streaming-layout {
          margin-bottom: 24px;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          transition: box-shadow 0.3s;
          background-color: #fff;
        }
        
        .streaming-layout.critical {
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }
        
        .streaming-layout-title {
          margin: 0;
          padding: 16px;
          background-color: #f5f5f5;
          border-bottom: 1px solid #e0e0e0;
          font-size: 18px;
          color: #333;
        }
        
        .streaming-layout-content {
          padding: 16px;
        }
        
        .streaming-layout-diagnostics {
          padding: 12px 16px;
          background-color: #f9f9f9;
          border-top: 1px solid #e0e0e0;
          font-size: 14px;
          color: #666;
        }
        
        .diagnostic-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        
        .diagnostic-label {
          font-weight: bold;
        }
        
        .diagnostic-value {
          font-family: monospace;
        }
        
        .diagnostic-value.priority-critical {
          color: #d32f2f;
          font-weight: bold;
        }
        
        .diagnostic-value.priority-high {
          color: #f57c00;
          font-weight: bold;
        }
        
        .diagnostic-value.priority-medium {
          color: #0288d1;
        }
        
        .diagnostic-value.priority-low {
          color: #388e3c;
        }
      `}</style>
    </section>
  );
}

// Add window augmentation for diagnostics
declare global {
  interface Window {
    __streamingStartTime?: number;
  }
}