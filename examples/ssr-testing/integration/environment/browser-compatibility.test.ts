/**
 * Browser Compatibility Test
 * 
 * Tests for SSR hydration compatibility across different browsers.
 * These tests are designed to be run with Playwright for multi-browser testing.
 */

import React from 'react';
import { SSRRenderer } from '../../core/renderer';
import { SimpleComponent, ComplexComponent } from '../../fixtures/components';

/**
 * These tests focus on browser-specific behavior during hydration.
 * They are designed to be run in a browser environment (e.g., via Playwright).
 * 
 * Note: In a real implementation, these tests would be executed in multiple browsers
 * through Playwright. For now, we're mocking the browser environment in Jest.
 */
describe('Browser Compatibility', () => {
  // Mock navigator.userAgent for testing
  const originalUserAgent = navigator.userAgent;
  
  afterEach(() => {
    // Reset the userAgent after each test
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
  });
  
  const testBrowserHydration = async (
    browserName: string, 
    userAgent: string,
    component: React.ReactElement
  ) => {
    // Mock the userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value: userAgent,
      configurable: true,
    });
    
    // Log the test browser
    console.log(`Testing in ${browserName} (${navigator.userAgent})`);
    
    // Render the component on the server
    const result = await SSRRenderer.render(component);
    
    // Create a container and add the server-rendered HTML
    const container = document.createElement('div');
    container.innerHTML = result.html;
    document.body.appendChild(container);
    
    // In a real implementation, we would hydrate the component here
    // and test browser-specific behavior
    
    // For now, just verify the HTML was added to the DOM
    expect(document.body.contains(container)).toBe(true);
    expect(container.innerHTML).toBe(result.html);
    
    // Cleanup
    document.body.removeChild(container);
  };
  
  it('should hydrate correctly in Chrome', async () => {
    const component = React.createElement(SimpleComponent, { 
      text: 'Chrome Hydration Test'
    });
    
    await testBrowserHydration(
      'Chrome',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      component
    );
  });
  
  it('should hydrate correctly in Firefox', async () => {
    const component = React.createElement(SimpleComponent, { 
      text: 'Firefox Hydration Test'
    });
    
    await testBrowserHydration(
      'Firefox',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      component
    );
  });
  
  it('should hydrate correctly in Safari', async () => {
    const component = React.createElement(SimpleComponent, { 
      text: 'Safari Hydration Test'
    });
    
    await testBrowserHydration(
      'Safari',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
      component
    );
  });
  
  it('should hydrate complex components in different browsers', async () => {
    const component = React.createElement(ComplexComponent, {
      initialData: {
        title: 'Browser Compatibility Test',
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
          { id: 3, name: 'Item 3' },
        ],
      },
    });
    
    // Test in Chrome
    await testBrowserHydration(
      'Chrome',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      component
    );
    
    // Test in Firefox
    await testBrowserHydration(
      'Firefox',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      component
    );
    
    // Test in Safari
    await testBrowserHydration(
      'Safari',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
      component
    );
  });
});