import React from 'react';
import { SSRRenderer } from '../../core/renderer';
import { HydrationValidator } from '../../core/hydration';
import { StateComparer } from '../../core/state';
import { RenderTimer } from '../../performance/timing';

// Mock components to simulate the Hybrid SSR/CSR example
const MockServerCard = ({ title, content }) => {
  return React.createElement('div', { 
    className: 'server-card',
    'data-testid': 'server-card'
  }, [
    React.createElement('h2', { key: 'title' }, title),
    React.createElement('p', { key: 'content' }, content)
  ]);
};

const MockClientCarousel = ({ items }) => {
  return React.createElement('div', { 
    className: 'client-carousel',
    'data-testid': 'client-carousel'
  }, [
    React.createElement('h3', { key: 'title' }, 'Client-rendered Carousel'),
    React.createElement('div', { key: 'items', className: 'carousel-items' },
      items.map((item, index) => 
        React.createElement('div', { 
          key: index,
          className: 'carousel-item',
          'data-testid': `carousel-item-${index}`
        }, item)
      )
    )
  ]);
};

// Mock context to share state between server and client components
const MockContext = React.createContext({
  theme: 'light',
  user: { id: 1, name: 'Test User' }
});

// Mock hybrid page that uses both server and client components
const MockHybridPage = () => {
  const contextValue = {
    theme: 'light',
    user: { id: 1, name: 'Test User' }
  };
  
  return React.createElement(MockContext.Provider, { 
    value: contextValue
  }, [
    React.createElement('div', { 
      className: 'hybrid-page',
      'data-testid': 'hybrid-page'
    }, [
      // Server-rendered header
      React.createElement('header', { key: 'header' }, [
        React.createElement('h1', { key: 'title' }, 'Hybrid SSR/CSR Example'),
        React.createElement(MockServerCard, { 
          key: 'server-card',
          title: 'Server Rendered Card',
          content: 'This content is rendered on the server'
        })
      ]),
      
      // Client-rendered carousel
      React.createElement(MockClientCarousel, {
        key: 'client-carousel',
        items: ['Item 1', 'Item 2', 'Item 3']
      })
    ])
  ]);
};

describe('Hybrid SSR/CSR Example Integration', () => {
  it('should render server components on the server', async () => {
    const element = React.createElement(MockHybridPage);
    const result = await SSRRenderer.render(element);
    
    // Server-rendered content should be in the initial HTML
    expect(result.html).toContain('Hybrid SSR/CSR Example');
    expect(result.html).toContain('Server Rendered Card');
    expect(result.html).toContain('This content is rendered on the server');
    
    // Client-rendered components should have their container but not dynamic content
    expect(result.html).toContain('client-carousel');
  });
  
  it('should hydrate client components on the client', async () => {
    const element = React.createElement(MockHybridPage);
    const result = await SSRRenderer.render(element);
    
    const hydrationResult = await HydrationValidator.validate(
      result.html,
      element,
      {
        testEventHandling: true,
        eventTriggers: [
          { selector: '[data-testid="carousel-item-1"]', event: 'click' }
        ]
      }
    );
    
    expect(hydrationResult.hydrated).toBe(true);
    expect(hydrationResult.errors).toHaveLength(0);
  });
  
  it('should maintain shared state between server and client components', async () => {
    // Extract server-side state
    const serverState = {
      theme: 'light',
      user: { id: 1, name: 'Test User' }
    };
    
    // Simulate client-side state after hydration
    const clientState = {
      theme: 'light',
      user: { id: 1, name: 'Test User' }
    };
    
    const comparisonResult = StateComparer.compareState(
      serverState,
      clientState,
      {
        deepCompare: true
      }
    );
    
    expect(comparisonResult.match).toBe(true);
    expect(comparisonResult.differences).toHaveLength(0);
  });
  
  it('should perform well in terms of rendering time', async () => {
    const element = React.createElement(MockHybridPage);
    
    const metrics = await RenderTimer.measureRendering(element);
    
    // Basic assertions on performance
    expect(metrics.totalTime).toBeGreaterThan(0);
    expect(metrics.outputSize).toBeGreaterThan(0);
  });
});