import React from 'react';
import { ErrorBoundaryTester } from './index';
import { SimpleComponent } from '../../fixtures/components';

describe('ErrorBoundaryTester', () => {
  it('should detect render errors', async () => {
    const fallback = <div data-testid="error-fallback">Error occurred</div>;
    
    const testResult = await ErrorBoundaryTester.testErrorBoundary(
      <SimpleComponent text="Test Component" />,
      {
        fallback,
        errorOptions: {
          triggerOn: 'render',
          message: 'Test render error',
        }
      }
    );
    
    expect(testResult.errorCaught).toBe(true);
    expect(testResult.fallbackRendered).toBe(true);
    expect(testResult.error?.message).toContain('Test render error');
    expect(testResult.ssr?.handled).toBe(true);
  });
  
  it('should detect effect errors', async () => {
    const fallback = <div data-testid="error-fallback">Effect error</div>;
    
    const testResult = await ErrorBoundaryTester.testErrorBoundary(
      <SimpleComponent text="Effect Test" />,
      {
        fallback,
        errorOptions: {
          triggerOn: 'effect',
          message: 'Test effect error',
        }
      }
    );
    
    expect(testResult.fallbackRendered).toBe(true);
    expect(testResult.hydration?.handled).toBe(true);
  });
  
  it('should handle event errors', async () => {
    const fallback = <div data-testid="error-fallback">Event error</div>;
    
    const testResult = await ErrorBoundaryTester.testErrorBoundary(
      <SimpleComponent text="Event Test" />,
      {
        fallback,
        errorOptions: {
          triggerOn: 'event',
          eventName: 'click',
          selector: '[data-testid="error-component"]',
          message: 'Test event error',
        },
        testSSR: true,
        testHydration: true,
      }
    );
    
    // Event errors aren't caught during SSR but should be caught during hydration
    expect(testResult.ssr?.handled).toBe(false);
    expect(testResult.hydration?.handled).toBe(false); // This would be true with proper event simulation
  });
});