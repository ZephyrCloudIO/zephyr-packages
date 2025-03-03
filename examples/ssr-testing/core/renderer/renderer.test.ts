import React from 'react';
import { SSRRenderer } from './index';
import { SimpleComponent } from '../../fixtures/components';

// Mock renderToPipeableStream since it's not supported in jsdom
jest.mock('react-dom/server', () => {
  const original = jest.requireActual('react-dom/server');
  return {
    ...original,
    renderToPipeableStream: jest.fn().mockImplementation((element, options) => {
      // Simulate streaming by calling onAllReady immediately
      setTimeout(() => options.onAllReady(), 10);
      
      return {
        pipe: (stream) => {
          // Simulate writing to the stream
          setTimeout(() => {
            const html = original.renderToString(element);
            stream.write(html);
            stream.end();
          }, 20);
        }
      };
    })
  };
});

describe('SSRRenderer', () => {
  it('should render a component to string', async () => {
    const element = React.createElement(SimpleComponent, { text: 'Test Component' });
    const result = await SSRRenderer.render(element);
    
    expect(result.html).toContain('Test Component');
    expect(result.html).toContain('simple-component');
    expect(result.errors).toHaveLength(0);
    expect(result.renderTime).toBeGreaterThan(0);
    expect(result.size).toBeGreaterThan(0);
  });
  
  it('should render a component to static markup', async () => {
    const element = React.createElement(SimpleComponent, { text: 'Static Markup' });
    const result = await SSRRenderer.render(element, { mode: 'static' });
    
    expect(result.html).toContain('Static Markup');
    expect(result.html).toContain('simple-component');
    expect(result.errors).toHaveLength(0);
  });
  
  it('should render a component to stream', async () => {
    const element = React.createElement(SimpleComponent, { text: 'Streaming Content' });
    const result = await SSRRenderer.render(element, { mode: 'stream' });
    
    expect(result.html).toContain('Streaming Content');
    expect(result.html).toContain('simple-component');
    expect(result.errors).toHaveLength(0);
    expect(result.stream).toBeDefined();
    expect(result.stream?.timeToFirstByte).toBeGreaterThanOrEqual(0);
    expect(result.stream?.chunks.length).toBeGreaterThan(0);
  });
  
  it('should catch and report errors during rendering', async () => {
    // Create a component that throws an error
    const ErrorComponent = () => {
      throw new Error('Test error');
    };
    
    const element = React.createElement(ErrorComponent);
    const result = await SSRRenderer.render(element);
    
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Test error');
  });
});