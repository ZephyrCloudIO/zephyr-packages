import React, { Suspense, useState, useEffect } from 'react';
import { StreamingPriority } from 'streaming-ssr-shared/dist/types';

interface StreamingRegionProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  priority?: StreamingPriority;
  deferTime?: number;
  visibilityThreshold?: number;
  testId?: string;
}

/**
 * Default fallback component for streaming regions
 */
function DefaultFallback() {
  return (
    <div className="streaming-region-fallback">
      <div className="streaming-region-shimmer"></div>
      <style jsx>{`
        .streaming-region-fallback {
          background-color: #f0f0f0;
          border-radius: 8px;
          overflow: hidden;
          min-height: 100px;
          position: relative;
        }
        
        .streaming-region-shimmer {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.5) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          animation: shimmer 2s infinite;
        }
        
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * A component that manages streaming content based on priority and visibility
 * 
 * Features:
 * - Priority-based loading order
 * - Optional deferred loading based on time
 * - Visibility-based lazy loading (only loads when visible)
 * - Custom fallback UI support
 */
export default function StreamingRegion({
  children,
  fallback,
  priority = 'medium',
  deferTime = 0,
  visibilityThreshold = 0.1,
  testId
}: StreamingRegionProps) {
  const [shouldRender, setShouldRender] = useState(priority === 'critical');
  const regionRef = React.useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // If it's critical, we always render immediately
    if (priority === 'critical') {
      setShouldRender(true);
      return;
    }
    
    // Handle deferred loading based on time
    let timeoutId: NodeJS.Timeout | null = null;
    if (deferTime > 0) {
      timeoutId = setTimeout(() => {
        setShouldRender(true);
      }, deferTime);
    }
    
    // Handle visibility-based loading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // If visible, render the content (after a small delay for high priority)
            const visibilityDelay = priority === 'high' ? 100 : 300;
            setTimeout(() => {
              setShouldRender(true);
            }, visibilityDelay);
            
            // Once we've decided to render, disconnect the observer
            observer.disconnect();
          }
        });
      },
      {
        root: null,
        rootMargin: '100px', // Load a bit before it comes into view
        threshold: visibilityThreshold
      }
    );
    
    if (regionRef.current) {
      observer.observe(regionRef.current);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [priority, deferTime, visibilityThreshold]);

  return (
    <div 
      ref={regionRef} 
      className={`streaming-region priority-${priority}`}
      data-testid={testId}
      data-priority={priority}
    >
      {shouldRender ? (
        <Suspense fallback={fallback || <DefaultFallback />}>
          {children}
        </Suspense>
      ) : (
        fallback || <DefaultFallback />
      )}
      
      <style jsx>{`
        .streaming-region {
          position: relative;
          border-radius: 8px;
          overflow: hidden;
        }
        
        /* Optional visual indicators for different priorities */
        .streaming-region.priority-critical {
          order: 1;
        }
        
        .streaming-region.priority-high {
          order: 2;
        }
        
        .streaming-region.priority-medium {
          order: 3;
        }
        
        .streaming-region.priority-low {
          order: 4;
        }
      `}</style>
    </div>
  );
}