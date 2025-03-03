import React from 'react';
import { SSRRenderer } from './index';
import { SimpleComponent } from '../../fixtures/components';

// Additional test components for state capture testing
const ComponentWithState = ({ initialState }: { initialState: { count: number } }) => {
  // In a real component, this would be managed with useState/useReducer
  const state = initialState;
  
  return (
    <div className="state-component">
      <h1>Component with State</h1>
      <p>Count: {state.count}</p>
      <script
        id="__ZEPHYR_STATE__"
        type="application/json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({ count: state.count })
        }}
      />
    </div>
  );
};

const ComponentWithDataAttributes = ({ items }: { items: string[] }) => (
  <div 
    className="data-component"
    data-zephyr-state={encodeURIComponent(JSON.stringify({ items }))}
  >
    <h1>Component with Data Attributes</h1>
    <ul>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  </div>
);

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
  
  it('should capture state from script tags when requested', async () => {
    const element = React.createElement(ComponentWithState, { initialState: { count: 42 } });
    const result = await SSRRenderer.render(element, { captureState: true });
    
    expect(result.html).toContain('Count: 42');
    expect(result.state).toBeDefined();
    expect(result.state?.count).toBe(42);
    expect(result.errors).toHaveLength(0);
  });
  
  it('should capture state from data attributes when requested', async () => {
    const element = React.createElement(ComponentWithDataAttributes, { 
      items: ['Item 1', 'Item 2', 'Item 3']
    });
    
    const result = await SSRRenderer.render(element, { captureState: true });
    
    expect(result.html).toContain('Item 1');
    expect(result.html).toContain('Item 2');
    expect(result.state).toBeDefined();
    expect(result.state?.items).toEqual(['Item 1', 'Item 2', 'Item 3']);
    expect(result.errors).toHaveLength(0);
  });
  
  it('should not capture state when captureState is false', async () => {
    const element = React.createElement(ComponentWithState, { initialState: { count: 42 } });
    const result = await SSRRenderer.render(element, { captureState: false });
    
    expect(result.html).toContain('Count: 42');
    expect(result.state).toBeUndefined();
    expect(result.errors).toHaveLength(0);
  });
  
  it('should handle malformed state gracefully', async () => {
    // Create a component with malformed state
    const MalformedStateComponent = () => (
      <div>
        <script
          id="__ZEPHYR_STATE__"
          type="application/json"
          dangerouslySetInnerHTML={{
            __html: '{malformed json'
          }}
        />
      </div>
    );
    
    const element = React.createElement(MalformedStateComponent);
    const result = await SSRRenderer.render(element, { captureState: true });
    
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Failed to parse captured state');
    expect(result.state).toEqual({});
  });
});