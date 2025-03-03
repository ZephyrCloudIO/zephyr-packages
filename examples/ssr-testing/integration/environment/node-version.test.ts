/**
 * Node.js Version Compatibility Test
 * 
 * Tests for SSR compatibility across different Node.js versions.
 * Validates that the core SSR functionality works consistently.
 */

import React from 'react';
import { SSRRenderer } from '../../core/renderer';
import { SimpleComponent } from '../../fixtures/components';

/**
 * These tests are designed to run in different Node.js environments
 * as part of the CI workflow. The tests themselves are simple and focus
 * on basic functionality that should work across all supported Node.js versions.
 */
describe('Node.js Version Compatibility', () => {
  it('should render basic components on the server', async () => {
    const element = React.createElement(SimpleComponent, { text: 'Node.js Version Test' });
    const result = await SSRRenderer.render(element);
    
    // Basic assertions that should pass in all Node.js versions
    expect(result.html).toContain('Node.js Version Test');
    expect(result.html).toContain('simple-component');
    expect(result.errors).toHaveLength(0);
  });
  
  it('should support async rendering operations', async () => {
    // Create a component with async operations
    const AsyncComponent = () => {
      const [data, setData] = React.useState('Initial');
      
      // This won't actually run on the server, but tests Node.js compatibility
      React.useEffect(() => {
        Promise.resolve().then(() => {
          setData('Updated');
        });
      }, []);
      
      return React.createElement('div', { 
        className: 'async-component',
        'data-testid': 'async-component'
      }, [
        React.createElement('h2', { key: 'title' }, 'Async Component'),
        React.createElement('p', { key: 'data' }, data)
      ]);
    };
    
    const element = React.createElement(AsyncComponent);
    const result = await SSRRenderer.render(element);
    
    // Verify basic rendering worked
    expect(result.html).toContain('Async Component');
    expect(result.html).toContain('Initial'); // Should have initial state on server
    expect(result.errors).toHaveLength(0);
  });
  
  it('should handle Node.js-specific features correctly', async () => {
    // Log Node.js version for debugging
    console.log(`Running on Node.js ${process.version}`);
    
    // Test that process.env is accessible
    expect(process.env).toBeDefined();
    
    // Create a component that accesses Node.js-specific features
    const NodeComponent = () => {
      const nodeVersion = process.version;
      
      return React.createElement('div', { 
        className: 'node-component',
        'data-testid': 'node-component'
      }, [
        React.createElement('h2', { key: 'title' }, 'Node.js Component'),
        React.createElement('p', { key: 'version' }, `Node.js Version: ${nodeVersion}`)
      ]);
    };
    
    const element = React.createElement(NodeComponent);
    const result = await SSRRenderer.render(element);
    
    // Verify basic rendering worked
    expect(result.html).toContain('Node.js Component');
    expect(result.html).toContain(`Node.js Version: ${process.version}`);
    expect(result.errors).toHaveLength(0);
  });
});