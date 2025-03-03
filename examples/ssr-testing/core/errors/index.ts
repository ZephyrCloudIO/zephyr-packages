/**
 * Error Boundary Tester
 * 
 * A utility for testing error boundaries in SSR components.
 * Simulates errors and validates error recovery mechanisms.
 */

import React, { Component, ErrorInfo } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

// Error boundary component for testing
class TestErrorBoundary extends Component<
  { 
    fallback: React.ReactNode; 
    children: React.ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
  },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export interface ErrorSimulationOptions {
  /**
   * When to trigger the error (render, effect, event, async)
   */
  triggerOn: 'render' | 'effect' | 'event' | 'async';
  
  /**
   * Delay before triggering async errors (in milliseconds)
   */
  delay?: number;
  
  /**
   * Event name to trigger error on (if triggerOn is 'event')
   */
  eventName?: string;
  
  /**
   * CSS selector for the element to trigger event on
   */
  selector?: string;
  
  /**
   * Custom error message
   */
  message?: string;
}

export interface ErrorBoundaryTestOptions {
  /**
   * The fallback UI to show when an error occurs
   */
  fallback: React.ReactNode;
  
  /**
   * Error simulation options
   */
  errorOptions: ErrorSimulationOptions;
  
  /**
   * Whether to test SSR handling
   */
  testSSR?: boolean;
  
  /**
   * Whether to test client hydration
   */
  testHydration?: boolean;
  
  /**
   * Timeout for the test in milliseconds
   */
  timeout?: number;
}

export interface ErrorBoundaryTestResult {
  /**
   * Whether the error boundary caught the error
   */
  errorCaught: boolean;
  
  /**
   * Whether the fallback UI was rendered
   */
  fallbackRendered: boolean;
  
  /**
   * The error that was caught
   */
  error?: Error;
  
  /**
   * Server-side rendering results
   */
  ssr?: {
    /**
     * Whether the SSR handled the error
     */
    handled: boolean;
    
    /**
     * The rendered HTML
     */
    html: string;
  };
  
  /**
   * Client-side hydration results
   */
  hydration?: {
    /**
     * Whether the hydration handled the error
     */
    handled: boolean;
  };
}

// Create a component that will trigger an error based on options
function createErrorComponent(options: ErrorSimulationOptions): React.FC {
  const { triggerOn, delay = 100, message = 'Test error' } = options;
  
  return function ErrorComponent() {
    if (triggerOn === 'render') {
      throw new Error(message);
    }
    
    React.useEffect(() => {
      if (triggerOn === 'effect') {
        throw new Error(message);
      }
      
      if (triggerOn === 'async') {
        const timeoutId = setTimeout(() => {
          throw new Error(message);
        }, delay);
        
        return () => clearTimeout(timeoutId);
      }
    }, []);
    
    const handleEvent = () => {
      if (triggerOn === 'event') {
        throw new Error(message);
      }
    };
    
    return (
      <div 
        className="error-component" 
        data-testid="error-component"
        onClick={handleEvent}
      >
        Component that will trigger an error
      </div>
    );
  };
}

/**
 * Tests error boundaries with different error scenarios
 */
export async function testErrorBoundary(
  component: React.ReactElement,
  options: ErrorBoundaryTestOptions
): Promise<ErrorBoundaryTestResult> {
  const {
    fallback,
    errorOptions,
    testSSR = true,
    testHydration = true,
    timeout = 5000,
  } = options;
  
  const result: ErrorBoundaryTestResult = {
    errorCaught: false,
    fallbackRendered: false,
  };
  
  // Create error component
  const ErrorComponent = createErrorComponent(errorOptions);
  
  // Create a component with the error boundary
  let caughtError: Error | null = null;
  const handleError = (error: Error) => {
    caughtError = error;
    result.errorCaught = true;
  };
  
  const TestComponent = () => (
    <TestErrorBoundary 
      fallback={fallback} 
      onError={handleError}
    >
      {React.cloneElement(component, {}, <ErrorComponent />)}
    </TestErrorBoundary>
  );
  
  // Test SSR handling
  if (testSSR) {
    try {
      const html = renderToString(<TestComponent />);
      
      result.ssr = {
        handled: !html.includes('error-component') && html.includes('fallback'),
        html,
      };
      
      result.fallbackRendered = result.ssr.handled;
    } catch (error) {
      result.ssr = {
        handled: false,
        html: '',
      };
    }
  }
  
  // Test client hydration
  if (testHydration) {
    // Create a container with SSR output if available, or empty otherwise
    const container = document.createElement('div');
    if (result.ssr?.html) {
      container.innerHTML = result.ssr.html;
    }
    document.body.appendChild(container);
    
    try {
      await act(async () => {
        hydrateRoot(container, <TestComponent />);
        
        // Wait for effects to run
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Trigger event if necessary
        if (errorOptions.triggerOn === 'event' && errorOptions.selector) {
          const element = container.querySelector(errorOptions.selector);
          if (element) {
            const eventName = errorOptions.eventName || 'click';
            const event = new Event(eventName, { bubbles: true });
            element.dispatchEvent(event);
          }
        }
        
        // Wait for async errors if necessary
        if (errorOptions.triggerOn === 'async') {
          await new Promise(resolve => setTimeout(resolve, errorOptions.delay || 100));
        }
      });
      
      result.hydration = {
        handled: !container.querySelector('[data-testid="error-component"]') && 
                container.textContent?.includes('fallback'),
      };
      
      result.fallbackRendered = result.fallbackRendered || result.hydration.handled;
    } catch (error) {
      result.hydration = {
        handled: false,
      };
    } finally {
      document.body.removeChild(container);
    }
  }
  
  if (caughtError) {
    result.error = caughtError;
  }
  
  return result;
}

export const ErrorBoundaryTester = {
  testErrorBoundary,
  TestErrorBoundary,
};

export default ErrorBoundaryTester;