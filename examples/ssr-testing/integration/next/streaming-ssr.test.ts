import React, { Suspense } from 'react';
import { SSRRenderer } from '../../core/renderer';
import { StreamingAnalyzer } from '../../performance/streaming';
import { StreamingComponent } from '../../fixtures/components';

// Mock components to simulate the Next.js Streaming SSR example
const MockCommentsStream = () => {
  return React.createElement('div', { 
    className: 'comments-stream',
    'data-testid': 'comments-stream'
  }, [
    React.createElement('h3', { key: 'title' }, 'Comments'),
    React.createElement('ul', { key: 'list' }, [
      React.createElement('li', { key: '1' }, 'First comment'),
      React.createElement('li', { key: '2' }, 'Second comment'),
      React.createElement('li', { key: '3' }, 'Third comment'),
    ])
  ]);
};

const MockProductStream = () => {
  return React.createElement('div', { 
    className: 'product-stream',
    'data-testid': 'product-stream'
  }, [
    React.createElement('h2', { key: 'title' }, 'Product Details'),
    React.createElement('p', { key: 'desc' }, 'This is a product description'),
    React.createElement('span', { key: 'price' }, 'Price: $99.99')
  ]);
};

const MockLoadingFallback = () => {
  return React.createElement('div', {
    className: 'loading-fallback',
    'data-testid': 'loading-fallback'
  }, 'Loading...');
};

const MockProductPage = () => {
  return React.createElement('div', {
    className: 'product-page',
    'data-testid': 'product-page'
  }, [
    // Critical content - render immediately
    React.createElement('header', { key: 'header' }, [
      React.createElement('h1', { key: 'title' }, 'Product Page'),
      React.createElement('nav', { key: 'nav' }, 'Navigation')
    ]),
    
    // Critical product information - high priority
    React.createElement(Suspense, { 
      fallback: React.createElement(MockLoadingFallback),
      key: 'product-section'
    }, [
      React.createElement(MockProductStream, { key: 'product' })
    ]),
    
    // Non-critical comments - lower priority
    React.createElement(Suspense, { 
      fallback: React.createElement(MockLoadingFallback),
      key: 'comments-section'
    }, [
      React.createElement(MockCommentsStream, { key: 'comments' })
    ])
  ]);
};

describe('Streaming SSR Example Integration', () => {
  it('should render with streaming and proper suspense boundaries', async () => {
    // Use a real streaming component from our fixtures
    const result = await SSRRenderer.render(
      React.createElement(StreamingComponent),
      { mode: 'stream' }
    );
    
    expect(result.html).toContain('Streaming Demo');
    expect(result.html).toContain('Critical Content');
    expect(result.html).toContain('Fast Content');
    expect(result.html).toContain('Medium Content');
    expect(result.html).toContain('Slow Content');
    expect(result.errors).toHaveLength(0);
    expect(result.stream).toBeDefined();
  });
  
  it('should analyze streaming patterns for the product page', async () => {
    const analysisResult = await StreamingAnalyzer.analyzeStreaming(
      React.createElement(MockProductPage),
      {
        contentPriorities: [
          { selector: 'product-page', priority: 10, isCritical: true },
          { selector: 'product-stream', priority: 9, isCritical: true },
          { selector: 'comments-stream', priority: 5, isCritical: false }
        ],
        suspenseFallbackSelectors: ['loading-fallback'],
        suspenseContentSelectors: ['product-stream', 'comments-stream'],
        saveRawChunks: true
      }
    );
    
    const { metrics, chunks } = analysisResult;
    
    // Verify basic metrics
    expect(metrics.totalTime).toBeGreaterThan(0);
    expect(metrics.timeToFirstByte).toBeGreaterThanOrEqual(0);
    expect(metrics.chunkCount).toBeGreaterThan(0);
    
    // Verify content delivery - critical content should come before non-critical
    const productDelivery = metrics.contentDelivery.find(c => c.selector === 'product-stream');
    const commentsDelivery = metrics.contentDelivery.find(c => c.selector === 'comments-stream');
    
    // If both are found, product should come before comments due to priority
    if (productDelivery && commentsDelivery) {
      expect(productDelivery.deliveryTime).toBeLessThanOrEqual(commentsDelivery.deliveryTime);
    }
    
    // Verify chunks contain suspense fallbacks
    if (chunks) {
      const hasFallback = chunks.some(chunk => chunk.hasSuspenseFallback);
      expect(hasFallback).toBe(true);
    }
  });
  
  it('should measure streaming performance metrics', async () => {
    const analysisResult = await StreamingAnalyzer.analyzeStreaming(
      React.createElement(StreamingComponent),
      {
        contentPriorities: [
          { selector: 'critical-content', priority: 10, isCritical: true },
          { selector: 'fast-content', priority: 8, isCritical: true },
          { selector: 'medium-content', priority: 5, isCritical: false },
          { selector: 'slow-content', priority: 3, isCritical: false }
        ],
        suspenseFallbackSelectors: ['fast-fallback', 'medium-fallback', 'slow-fallback'],
        suspenseContentSelectors: ['fast-content', 'medium-content', 'slow-content']
      }
    );
    
    const { metrics } = analysisResult;
    
    // Critical content should render quickly
    expect(metrics.timeToFirstContentfulPaint).toBeLessThan(metrics.totalTime);
    
    // Should have multiple suspense resolutions
    expect(metrics.suspenseResolution.length).toBeGreaterThanOrEqual(1);
    
    // Each suspense resolution should have timing information
    for (const resolution of metrics.suspenseResolution) {
      expect(resolution.fallbackTime).toBeGreaterThanOrEqual(0);
      expect(resolution.resolvedTime).toBeGreaterThan(resolution.fallbackTime);
      expect(resolution.resolutionTime).toBeGreaterThan(0);
    }
  });
});