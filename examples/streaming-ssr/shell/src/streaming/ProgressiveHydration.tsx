import React, { useState, useEffect, useRef } from 'react';
import { StreamingPriority } from 'streaming-ssr-shared/dist/types';

interface ProgressiveHydrationProps {
  children: React.ReactNode;
  priority?: StreamingPriority;
  visibilityThreshold?: number;
  hydrateOnInteraction?: boolean;
  hydrateOnIdle?: boolean;
  testId?: string;
}

/**
 * A component that implements progressive hydration strategies
 * 
 * Features:
 * - Priority-based hydration order
 * - Visibility-based hydration (only hydrates when visible)
 * - Interaction-based hydration (hydrates on user interaction)
 * - Idle time hydration (hydrates during browser idle time)
 * - Works with both React 18 Suspense and traditional hydration
 */
export default function ProgressiveHydration({
  children,
  priority = 'medium',
  visibilityThreshold = 0.1,
  hydrateOnInteraction = true,
  hydrateOnIdle = true,
  testId
}: ProgressiveHydrationProps) {
  // Track hydration state
  const [isHydrated, setIsHydrated] = useState(false);
  // Track if this component is mounted on client
  const [isClient, setIsClient] = useState(false);
  // Keep reference to the DOM element
  const ref = useRef<HTMLDivElement>(null);
  // Store event listeners for cleanup
  const listeners = useRef<{ type: string; handler: EventListener }[]>([]);
  
  // Set client state on mount
  useEffect(() => {
    setIsClient(true);
    
    // Immediately hydrate critical components
    if (priority === 'critical') {
      setIsHydrated(true);
    }
  }, [priority]);
  
  // Handle visibility-based hydration
  useEffect(() => {
    if (isClient && !isHydrated && ref.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              // Determine delay based on priority
              let delay = 0;
              switch (priority) {
                case 'high':
                  delay = 200;
                  break;
                case 'medium':
                  delay = 500;
                  break;
                case 'low':
                  delay = 1000;
                  break;
                default:
                  delay = 0;
              }
              
              // Apply the delay then hydrate
              setTimeout(() => {
                setIsHydrated(true);
              }, delay);
              
              // Once we've decided to hydrate, disconnect the observer
              observer.disconnect();
            }
          });
        },
        {
          root: null,
          rootMargin: '100px', // Start hydration a bit before it becomes visible
          threshold: visibilityThreshold
        }
      );
      
      observer.observe(ref.current);
      
      return () => {
        observer.disconnect();
      };
    }
  }, [isClient, isHydrated, priority, visibilityThreshold]);
  
  // Handle interaction-based hydration
  useEffect(() => {
    if (isClient && !isHydrated && hydrateOnInteraction && ref.current) {
      const interactionEvents = ['mouseenter', 'touchstart', 'focus'];
      
      const hydrateOnInteract = (event: Event) => {
        // Only handle it once to avoid repeated work
        interactionEvents.forEach(type => {
          ref.current?.removeEventListener(type, hydrateOnInteract);
        });
        
        // Hydrate in response to interaction
        setIsHydrated(true);
      };
      
      // Add all interaction listeners
      interactionEvents.forEach(type => {
        ref.current?.addEventListener(type, hydrateOnInteract, { once: true });
        listeners.current.push({ type, handler: hydrateOnInteract });
      });
    }
    
    return () => {
      // Clean up all event listeners
      if (ref.current) {
        listeners.current.forEach(({ type, handler }) => {
          ref.current?.removeEventListener(type, handler);
        });
        listeners.current = [];
      }
    };
  }, [isClient, isHydrated, hydrateOnInteraction]);
  
  // Handle idle-time hydration
  useEffect(() => {
    if (isClient && !isHydrated && hydrateOnIdle && 'requestIdleCallback' in window) {
      // Use requestIdleCallback to hydrate during idle time
      const idleCallback = window.requestIdleCallback(() => {
        setIsHydrated(true);
      }, { timeout: 2000 }); // 2 second timeout as failsafe
      
      return () => {
        window.cancelIdleCallback(idleCallback);
      };
    }
  }, [isClient, isHydrated, hydrateOnIdle]);
  
  // If this is client-side and not yet hydrated, show a placeholder
  if (isClient && !isHydrated) {
    return (
      <div 
        ref={ref}
        className={`progressive-hydration priority-${priority}`}
        data-testid={testId}
        data-hydrated="false"
        data-priority={priority}
      >
        <div className="progressive-hydration-placeholder" />
        
        <style jsx>{`
          .progressive-hydration {
            min-height: 50px;
            position: relative;
            background-color: #f5f5f5;
            border-radius: 4px;
            overflow: hidden;
          }
          
          .progressive-hydration-placeholder {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(
              90deg,
              rgba(255, 255, 255, 0) 0%,
              rgba(255, 255, 255, 0.6) 50%,
              rgba(255, 255, 255, 0) 100%
            );
            background-size: 200% 100%;
            animation: shimmer 2s infinite;
          }
          
          @keyframes shimmer {
            0% {
              background-position: -200% 0;
            }
            100% {
              background-position: 200% 0;
            }
          }
        `}</style>
      </div>
    );
  }
  
  // Either server-rendered or hydrated content
  return (
    <div 
      ref={ref}
      className={`progressive-hydration priority-${priority}`}
      data-testid={testId}
      data-hydrated={isClient ? 'true' : 'false'}
      data-priority={priority}
    >
      {children}
      
      <style jsx>{`
        .progressive-hydration {
          position: relative;
        }
      `}</style>
    </div>
  );
}

// Type definitions for requestIdleCallback for TypeScript
declare global {
  interface Window {
    requestIdleCallback: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions
    ) => number;
    cancelIdleCallback: (handle: number) => void;
  }
  
  interface IdleRequestCallback {
    (deadline: IdleDeadline): void;
  }
  
  interface IdleDeadline {
    readonly didTimeout: boolean;
    timeRemaining: () => number;
  }
  
  interface IdleRequestOptions {
    timeout?: number;
  }
}