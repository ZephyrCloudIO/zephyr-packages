/**
 * Hydration Validator
 * 
 * A utility for validating client-side hydration of server-rendered components.
 * Tests for successful hydration, event handling, and state consistency.
 */

import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

export interface HydrationOptions {
  /**
   * Whether to capture console errors during hydration
   */
  captureConsoleErrors?: boolean;
  
  /**
   * Whether to test event handling after hydration
   */
  testEventHandling?: boolean;
  
  /**
   * Timeout for hydration in milliseconds
   */
  timeout?: number;
  
  /**
   * Custom event triggers to test after hydration
   */
  eventTriggers?: Array<{
    selector: string;
    event: string;
    options?: any;
  }>;
}

export interface HydrationResult {
  /**
   * Whether hydration was successful
   */
  hydrated: boolean;
  
  /**
   * Any errors that occurred during hydration
   */
  errors: Error[];
  
  /**
   * Time it took to hydrate in milliseconds
   */
  hydrationTime: number;
  
  /**
   * Whether all events were handled successfully
   */
  eventsHandled?: boolean;
  
  /**
   * Details about event handling results
   */
  eventResults?: Record<string, any>;
}

/**
 * Validates client-side hydration of server-rendered HTML
 */
export async function validate(
  html: string,
  element: React.ReactElement,
  options: HydrationOptions = {}
): Promise<HydrationResult> {
  const {
    captureConsoleErrors = true,
    testEventHandling = false,
    timeout = 5000,
    eventTriggers = [],
  } = options;
  
  const errors: Error[] = [];
  const startTime = Date.now();
  let hydrated = false;
  let eventsHandled: boolean | undefined;
  let eventResults: Record<string, any> | undefined;
  
  // Create a container element with the server-rendered HTML
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  
  // Capture console errors during hydration
  const originalConsoleError = console.error;
  if (captureConsoleErrors) {
    console.error = (...args: any[]) => {
      const message = args.join(' ');
      // Filter out expected React hydration warnings for testing
      if (message.includes('Hydration') && message.includes('mismatch')) {
        errors.push(new Error(`Hydration mismatch: ${message}`));
      }
      originalConsoleError(...args);
    };
  }
  
  try {
    // Attempt to hydrate the component
    await act(async () => {
      hydrateRoot(container, element);
      
      // Wait for a short time to ensure hydration completes
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    
    hydrated = true;
    
    // Test event handling if requested
    if (testEventHandling) {
      const eventResults: Record<string, any> = {};
      let allEventsHandled = true;
      
      for (const trigger of eventTriggers) {
        try {
          const element = container.querySelector(trigger.selector);
          if (!element) {
            throw new Error(`Element not found: ${trigger.selector}`);
          }
          
          await act(async () => {
            const event = new Event(trigger.event, trigger.options);
            element.dispatchEvent(event);
            // Wait for event to be processed
            await new Promise((resolve) => setTimeout(resolve, 50));
          });
          
          eventResults[`${trigger.selector}:${trigger.event}`] = true;
        } catch (error) {
          allEventsHandled = false;
          eventResults[`${trigger.selector}:${trigger.event}`] = false;
          errors.push(error instanceof Error ? error : new Error(String(error)));
        }
      }
      
      eventsHandled = allEventsHandled;
      eventResults = eventResults;
    }
  } catch (error) {
    hydrated = false;
    errors.push(error instanceof Error ? error : new Error(String(error)));
  } finally {
    // Restore original console.error
    if (captureConsoleErrors) {
      console.error = originalConsoleError;
    }
    
    // Cleanup
    document.body.removeChild(container);
  }
  
  const hydrationTime = Date.now() - startTime;
  
  return {
    hydrated,
    errors,
    hydrationTime,
    eventsHandled,
    eventResults,
  };
}

export const HydrationValidator = {
  validate,
};

export default HydrationValidator;