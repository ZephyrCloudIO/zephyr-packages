import { SSRRenderer } from '../../core/renderer';
import { HydrationValidator } from '../../core/hydration';
import { RenderTimer } from '../../performance/timing';
import React from 'react';

// Mock components to simulate the Next.js SSR example
const MockRemoteButton = ({ text = 'Remote Button' }) => {
  return React.createElement('button', {
    className: 'remote-button',
    'data-testid': 'remote-button',
    onClick: () => console.log('Button clicked')
  }, text);
};

const MockServerComponent = () => {
  return React.createElement('div', { 
    className: 'server-component',
    'data-testid': 'server-component'
  }, [
    React.createElement('h2', { key: 'title' }, 'Server Component'),
    React.createElement(MockRemoteButton, { key: 'button', text: 'Click Me' })
  ]);
};

const MockPage = () => {
  return React.createElement('div', {
    className: 'page-container',
    'data-testid': 'page-container'
  }, [
    React.createElement('h1', { key: 'title' }, 'Next.js SSR Example'),
    React.createElement(MockServerComponent, { key: 'server-component' })
  ]);
};

describe('Basic Next.js SSR Example Integration', () => {
  it('should render the basic Next.js SSR example', async () => {
    const element = React.createElement(MockPage);
    const result = await SSRRenderer.render(element);
    
    expect(result.html).toContain('Next.js SSR Example');
    expect(result.html).toContain('Server Component');
    expect(result.html).toContain('Click Me');
    expect(result.errors).toHaveLength(0);
  });
  
  it('should hydrate the basic Next.js SSR example', async () => {
    const element = React.createElement(MockPage);
    const result = await SSRRenderer.render(element);
    
    const hydrationResult = await HydrationValidator.validate(
      result.html,
      element,
      {
        testEventHandling: true,
        eventTriggers: [
          { selector: '[data-testid="remote-button"]', event: 'click' }
        ]
      }
    );
    
    expect(hydrationResult.hydrated).toBe(true);
    expect(hydrationResult.errors).toHaveLength(0);
    expect(hydrationResult.eventsHandled).toBe(true);
  });
  
  it('should measure rendering performance', async () => {
    const element = React.createElement(MockPage);
    
    const metrics = await RenderTimer.measureRendering(element);
    
    expect(metrics.totalTime).toBeGreaterThan(0);
    expect(metrics.phases.rendering).toBeGreaterThan(0);
    expect(metrics.outputSize).toBeGreaterThan(0);
  });
  
  it('should measure hydration performance', async () => {
    const element = React.createElement(MockPage);
    const result = await SSRRenderer.render(element);
    
    const metrics = await RenderTimer.measureHydration(result.html, element);
    
    expect(metrics.totalTime).toBeGreaterThan(0);
    expect(metrics.phases.hydration).toBeGreaterThan(0);
  });
});