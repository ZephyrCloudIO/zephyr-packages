# Example Workflows: SSR Testing Infrastructure

This document provides step-by-step workflows for common SSR testing scenarios using the Zephyr SSR Testing Infrastructure.

## Workflow 1: Testing a New SSR Component

This workflow demonstrates how to test a new server-rendered component from development to production.

### Step 1: Create the Component with SSR in Mind

```tsx
// MyComponent.tsx
import React, { useState, useEffect } from 'react';

interface MyComponentProps {
  initialData: {
    title: string;
    items: Array<{ id: number; name: string }>;
  };
}

export const MyComponent: React.FC<MyComponentProps> = ({ initialData }) => {
  // Use the initialData for server rendering
  const [data, setData] = useState(initialData);
  
  // Client-side only effects
  useEffect(() => {
    // Fetch additional data on the client
    const fetchMoreData = async () => {
      // This will only run on the client
      const response = await fetch('/api/more-data');
      const moreData = await response.json();
      setData(prevData => ({
        ...prevData,
        items: [...prevData.items, ...moreData.items]
      }));
    };
    
    fetchMoreData();
  }, []);
  
  return (
    <div className="my-component">
      <h2>{data.title}</h2>
      <ul>
        {data.items.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
};
```

### Step 2: Create Basic Tests for Server Rendering

```tsx
// MyComponent.test.tsx
import React from 'react';
import { SSRRenderer } from '@ssr-testing/core/renderer';
import { MyComponent } from './MyComponent';

describe('MyComponent Server Rendering', () => {
  it('should render on the server with initial data', async () => {
    // Prepare test data
    const initialData = {
      title: 'Test Component',
      items: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ]
    };
    
    // Test server rendering
    const result = await SSRRenderer.render(
      <MyComponent initialData={initialData} />
    );
    
    // Verify the result
    expect(result.html).toContain('Test Component');
    expect(result.html).toContain('Item 1');
    expect(result.html).toContain('Item 2');
    expect(result.errors).toHaveLength(0);
  });
  
  it('should handle empty data gracefully', async () => {
    // Test with empty data
    const emptyData = {
      title: '',
      items: []
    };
    
    const result = await SSRRenderer.render(
      <MyComponent initialData={emptyData} />
    );
    
    // Verify it renders without errors
    expect(result.html).toContain('my-component');
    expect(result.errors).toHaveLength(0);
  });
});
```

### Step 3: Test Hydration and Client Interactions

```tsx
// MyComponent.hydration.test.tsx
import React from 'react';
import { SSRRenderer } from '@ssr-testing/core/renderer';
import { HydrationValidator } from '@ssr-testing/core/hydration';
import { MyComponent } from './MyComponent';

// Mock fetch for client-side tests
global.fetch = jest.fn(() => 
  Promise.resolve({
    json: () => Promise.resolve({ items: [{ id: 3, name: 'Item 3' }] })
  })
) as jest.Mock;

describe('MyComponent Hydration', () => {
  it('should hydrate correctly on the client', async () => {
    // Prepare test data
    const initialData = {
      title: 'Test Component',
      items: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ]
    };
    
    // First, render on the server
    const serverResult = await SSRRenderer.render(
      <MyComponent initialData={initialData} />
    );
    
    // Then, test hydration
    const hydrationResult = await HydrationValidator.validate(
      serverResult.html,
      <MyComponent initialData={initialData} />
    );
    
    // Verify hydration succeeded
    expect(hydrationResult.hydrated).toBe(true);
    expect(hydrationResult.errors).toHaveLength(0);
    
    // Verify client-side effects were applied
    expect(hydrationResult.dom).toContain('Item 3');
  });
});
```

### Step 4: Test Performance and Bundle Size

```tsx
// MyComponent.perf.test.tsx
import React from 'react';
import { RenderTimer } from '@ssr-testing/performance/timing';
import { BundleSizeAnalyzer } from '@ssr-testing/performance/bundle-size';
import { MyComponent } from './MyComponent';

describe('MyComponent Performance', () => {
  it('should render within performance budget', async () => {
    // Generate large dataset for performance testing
    const initialData = {
      title: 'Performance Test',
      items: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`
      }))
    };
    
    // Measure rendering performance
    const metrics = await RenderTimer.measure(
      <MyComponent initialData={initialData} />
    );
    
    // Assert performance metrics
    expect(metrics.serverRenderTime).toBeLessThan(100); // 100ms budget
    expect(metrics.clientHydrationTime).toBeLessThan(50); // 50ms budget
  });
  
  it('should maintain bundle size budget', async () => {
    // Analyze bundle sizes
    const bundleInfo = [
      { name: 'MyComponent.js', size: 15000, type: 'component' }
    ];
    
    const metrics = BundleSizeAnalyzer.analyzeComponent(bundleInfo);
    
    // Assert bundle size
    expect(metrics.totalSize).toBeLessThan(20000); // 20KB budget
  });
});
```

### Step 5: Test Error Handling and Boundary Cases

```tsx
// MyComponent.error.test.tsx
import React from 'react';
import { ErrorBoundaryTester } from '@ssr-testing/core/errors';
import { MyComponent } from './MyComponent';

describe('MyComponent Error Handling', () => {
  it('should handle data fetching errors gracefully', async () => {
    // Mock a failure scenario
    global.fetch = jest.fn(() => Promise.reject('API error')) as jest.Mock;
    
    const initialData = {
      title: 'Error Test',
      items: [{ id: 1, name: 'Item 1' }]
    };
    
    // Test with error boundary
    const result = await ErrorBoundaryTester.test(
      <MyComponent initialData={initialData} />
    );
    
    // Verify component doesn't crash
    expect(result.didCatch).toBe(false);
    expect(result.renderedOutput).toContain('Item 1');
  });
  
  it('should work with error boundaries', async () => {
    // Create a component that will throw
    const ThrowingComponent = () => {
      throw new Error('Test error');
      return null;
    };
    
    // Test with error boundary
    const result = await ErrorBoundaryTester.test(
      <>
        <MyComponent initialData={{ title: 'Error Test', items: [] }} />
        <ThrowingComponent />
      </>
    );
    
    // Verify error was caught but MyComponent still rendered
    expect(result.didCatch).toBe(true);
    expect(result.renderedOutput).toContain('Error Test');
  });
});
```

### Step 6: Integration Testing with Module Federation

```tsx
// MyComponent.integration.test.tsx
import React from 'react';
import { FederatedComponentTester } from '@ssr-testing/integration/federation';
import { MyComponent } from './MyComponent';

describe('MyComponent Federation Integration', () => {
  it('should work as a federated component', async () => {
    // Define federation config
    const fedConfig = {
      remote: 'my-app',
      scope: 'MyApp',
      module: './MyComponent',
      exposes: {
        './MyComponent': './src/components/MyComponent'
      }
    };
    
    // Test data
    const initialData = {
      title: 'Federated Component Test',
      items: [{ id: 1, name: 'Item 1' }]
    };
    
    // Test integration
    const result = await FederatedComponentTester.test(
      MyComponent,
      { initialData },
      fedConfig
    );
    
    // Verify federation works
    expect(result.federationSuccess).toBe(true);
    expect(result.serverRenderingSuccess).toBe(true);
    expect(result.hydrationSuccess).toBe(true);
  });
});
```

### Step 7: End-to-End Testing in a Real Environment

```tsx
// e2e-tests/MyComponent.spec.ts
import { test, expect } from '@playwright/test';

test('MyComponent works in a real SSR environment', async ({ page }) => {
  // Navigate to the page containing the component
  await page.goto('/my-component-page');
  
  // Check server-rendered content is visible immediately
  await expect(page.locator('.my-component h2')).toBeVisible();
  
  // Verify initial items are visible (from server render)
  await expect(page.locator('.my-component li')).toHaveCount(2);
  
  // Wait for client-side hydration and data fetching
  await page.waitForTimeout(500);
  
  // Verify client-side fetched items are now visible
  await expect(page.locator('.my-component li')).toHaveCount(3);
});
```

### Step 8: Production Monitoring Setup

```tsx
// monitoring/setup.ts
import { SSRMonitoring } from '@ssr-testing/monitoring';

// Set up monitoring for the component
SSRMonitoring.setupComponentMonitoring('MyComponent', {
  // Track server render time
  serverRenderTime: true,
  
  // Track hydration time
  hydrationTime: true,
  
  // Track error rates
  errorRate: true,
  
  // Set alert thresholds
  alertThresholds: {
    serverRenderTime: 200, // Alert if > 200ms
    hydrationTime: 100,    // Alert if > 100ms
    errorRate: 0.01        // Alert if > 1% error rate
  }
});
```

## Workflow 2: Benchmarking SSR Approaches

This workflow demonstrates how to benchmark different SSR approaches to find the optimal solution.

### Step 1: Define the Benchmarking Setup

```tsx
// benchmarks/setup.ts
import { BenchmarkRunner } from '@ssr-testing/performance/benchmark';
import { ProductPage } from './components/ProductPage';

// Define test data
const productData = {
  id: 'product-123',
  name: 'Test Product',
  description: 'A lengthy product description with lots of details...',
  price: 99.99,
  images: Array(10).fill(0).map((_, i) => `/img/product-${i}.jpg`),
  variants: Array(20).fill(0).map((_, i) => ({
    id: `variant-${i}`,
    name: `Variant ${i}`,
    price: 99.99 + i
  })),
  reviews: Array(50).fill(0).map((_, i) => ({
    id: `review-${i}`,
    user: `User ${i}`,
    rating: Math.floor(Math.random() * 5) + 1,
    comment: `Review comment ${i} with some text...`
  }))
};

// Configure benchmark
export const benchmarkConfig = {
  component: ProductPage,
  props: { product: productData },
  iterations: 50,
  warmupIterations: 5
};
```

### Step 2: Benchmark Traditional SSR Approach

```tsx
// benchmarks/traditional-ssr.bench.ts
import { BenchmarkRunner } from '@ssr-testing/performance/benchmark';
import { benchmarkConfig } from './setup';
import { traditionalRender } from '../src/rendering/traditional';

describe('Traditional SSR Benchmark', () => {
  it('measures traditional SSR performance', async () => {
    // Configure renderer
    const renderer = {
      name: 'Traditional SSR',
      renderFn: traditionalRender,
      options: {}
    };
    
    // Run benchmark
    const results = await BenchmarkRunner.run(benchmarkConfig, renderer);
    
    // Log results
    console.log('Traditional SSR Results:', results);
    
    // Store results for comparison
    await BenchmarkRunner.saveResults('traditional-ssr', results);
  });
});
```

### Step 3: Benchmark Streaming SSR Approach

```tsx
// benchmarks/streaming-ssr.bench.ts
import { BenchmarkRunner } from '@ssr-testing/performance/benchmark';
import { benchmarkConfig } from './setup';
import { streamingRender } from '../src/rendering/streaming';

describe('Streaming SSR Benchmark', () => {
  it('measures streaming SSR performance', async () => {
    // Configure renderer
    const renderer = {
      name: 'Streaming SSR',
      renderFn: streamingRender,
      options: {
        onShellReady: true,
        onAllReady: true
      }
    };
    
    // Run benchmark
    const results = await BenchmarkRunner.run(benchmarkConfig, renderer);
    
    // Log results
    console.log('Streaming SSR Results:', results);
    
    // Store results for comparison
    await BenchmarkRunner.saveResults('streaming-ssr', results);
  });
});
```

### Step 4: Benchmark Progressive Hydration Approach

```tsx
// benchmarks/progressive-hydration.bench.ts
import { BenchmarkRunner } from '@ssr-testing/performance/benchmark';
import { benchmarkConfig } from './setup';
import { progressiveRender } from '../src/rendering/progressive';

describe('Progressive Hydration Benchmark', () => {
  it('measures progressive hydration performance', async () => {
    // Configure renderer
    const renderer = {
      name: 'Progressive Hydration',
      renderFn: progressiveRender,
      options: {
        priorityLevels: ['critical', 'main', 'deferred']
      }
    };
    
    // Run benchmark
    const results = await BenchmarkRunner.run(benchmarkConfig, renderer);
    
    // Log results
    console.log('Progressive Hydration Results:', results);
    
    // Store results for comparison
    await BenchmarkRunner.saveResults('progressive-hydration', results);
  });
});
```

### Step 5: Generate Comparison Report

```tsx
// benchmarks/generate-report.ts
import { BenchmarkReporter } from '@ssr-testing/performance/reports';

async function generateComparisonReport() {
  // Load benchmark results
  const traditionalResults = await BenchmarkReporter.loadResults('traditional-ssr');
  const streamingResults = await BenchmarkReporter.loadResults('streaming-ssr');
  const progressiveResults = await BenchmarkReporter.loadResults('progressive-hydration');
  
  // Generate comparison report
  const report = await BenchmarkReporter.compareResults({
    'Traditional SSR': traditionalResults,
    'Streaming SSR': streamingResults,
    'Progressive Hydration': progressiveResults
  });
  
  // Save HTML report
  await BenchmarkReporter.saveHtmlReport('ssr-comparison', report);
  
  console.log('Report generated at: reports/ssr-comparison.html');
  
  // Print summary to console
  console.log('Performance Comparison Summary:');
  console.log('------------------------------');
  console.log(`Server Render Time:
    Traditional: ${traditionalResults.serverRenderTime.median}ms
    Streaming: ${streamingResults.serverRenderTime.median}ms
    Progressive: ${progressiveResults.serverRenderTime.median}ms`);
    
  console.log(`Time to First Byte:
    Traditional: ${traditionalResults.timeToFirstByte.median}ms
    Streaming: ${streamingResults.timeToFirstByte.median}ms
    Progressive: ${progressiveResults.timeToFirstByte.median}ms`);
    
  console.log(`Total Hydration Time:
    Traditional: ${traditionalResults.hydrationTime.median}ms
    Streaming: ${streamingResults.hydrationTime.median}ms
    Progressive: ${progressiveResults.hydrationTime.median}ms`);
}

generateComparisonReport().catch(console.error);
```

## Workflow 3: Testing SSR with Multiple Remotes

This workflow demonstrates how to test an SSR application that consumes multiple federated remotes.

### Step 1: Set Up Test Environment for Multiple Remotes

```tsx
// multi-remote/setup.ts
import { MultiRemoteTester } from '@ssr-testing/integration/multi-remote';

// Define remote configurations
export const remotes = {
  header: {
    name: 'header-app',
    url: 'http://localhost:3001/remoteEntry.js',
    scope: 'header',
    module: './Header',
    initialProps: {
      user: { name: 'Test User' },
      navigation: [
        { name: 'Home', url: '/' },
        { name: 'Products', url: '/products' }
      ]
    }
  },
  
  products: {
    name: 'products-app',
    url: 'http://localhost:3002/remoteEntry.js',
    scope: 'products',
    module: './ProductList',
    initialProps: {
      products: Array(10).fill(0).map((_, i) => ({
        id: `product-${i}`,
        name: `Product ${i}`,
        price: 9.99 + i
      }))
    }
  },
  
  cart: {
    name: 'cart-app',
    url: 'http://localhost:3003/remoteEntry.js',
    scope: 'cart',
    module: './Cart',
    initialProps: {
      items: [
        { id: 'product-1', quantity: 2 },
        { id: 'product-3', quantity: 1 }
      ]
    }
  }
};

// Set up shared context between remotes
export const sharedContext = {
  theme: 'light',
  currency: 'USD',
  user: { id: 'user-123', name: 'Test User' }
};
```

### Step 2: Test Server-Side Composition of Remotes

```tsx
// multi-remote/server-composition.test.ts
import { MultiRemoteTester } from '@ssr-testing/integration/multi-remote';
import { remotes, sharedContext } from './setup';

describe('Multi-Remote Server Composition', () => {
  it('should compose multiple remotes on the server', async () => {
    // Test server composition
    const result = await MultiRemoteTester.testServerComposition(
      remotes,
      sharedContext
    );
    
    // Verify all remotes rendered successfully
    expect(result.renderingSuccess).toBe(true);
    expect(result.renderedRemotes).toHaveLength(Object.keys(remotes).length);
    
    // Verify each remote's content
    expect(result.html).toContain('Test User');
    expect(result.html).toContain('Product 1');
    expect(result.html).toContain('Cart');
  });
  
  it('should handle missing remotes gracefully', async () => {
    // Create a test setup with one invalid remote
    const testRemotes = {
      ...remotes,
      invalid: {
        name: 'invalid-app',
        url: 'http://invalid/remoteEntry.js',
        scope: 'invalid',
        module: './Invalid',
        initialProps: {}
      }
    };
    
    // Test server composition with fallbacks enabled
    const result = await MultiRemoteTester.testServerComposition(
      testRemotes,
      sharedContext,
      { enableFallbacks: true }
    );
    
    // Verify the valid remotes still rendered
    expect(result.renderingSuccess).toBe(true);
    expect(result.renderedRemotes).toHaveLength(Object.keys(remotes).length);
    expect(result.failedRemotes).toContain('invalid');
    
    // Verify the fallback content was used
    expect(result.html).toContain('Fallback content for invalid-app');
  });
});
```

### Step 3: Test Client-Side Hydration of Multiple Remotes

```tsx
// multi-remote/client-hydration.test.ts
import { MultiRemoteTester } from '@ssr-testing/integration/multi-remote';
import { remotes, sharedContext } from './setup';

describe('Multi-Remote Client Hydration', () => {
  it('should hydrate all remotes on the client', async () => {
    // First, test server composition
    const serverResult = await MultiRemoteTester.testServerComposition(
      remotes,
      sharedContext
    );
    
    // Then, test client hydration
    const hydrationResult = await MultiRemoteTester.testClientHydration(
      serverResult.html,
      remotes,
      sharedContext
    );
    
    // Verify hydration succeeded for all remotes
    expect(hydrationResult.hydrationSuccess).toBe(true);
    expect(hydrationResult.hydratedRemotes).toHaveLength(Object.keys(remotes).length);
    
    // Verify interactive elements are working
    const cartInteraction = await hydrationResult.interact('cart', 'addToCart', { id: 'product-5' });
    expect(cartInteraction.success).toBe(true);
    expect(cartInteraction.result).toEqual({ added: true, id: 'product-5' });
  });
  
  it('should share context between remotes after hydration', async () => {
    // First, test server composition
    const serverResult = await MultiRemoteTester.testServerComposition(
      remotes,
      sharedContext
    );
    
    // Then, test client hydration
    const hydrationResult = await MultiRemoteTester.testClientHydration(
      serverResult.html,
      remotes,
      sharedContext
    );
    
    // Test context sharing between remotes
    const themeChange = await hydrationResult.updateSharedContext({
      theme: 'dark'
    });
    
    // Verify all remotes received the context update
    expect(themeChange.affectedRemotes).toHaveLength(Object.keys(remotes).length);
    expect(themeChange.updatedDOM).toContain('dark-theme');
  });
});
```

### Step 4: Test Streaming with Multiple Remotes

```tsx
// multi-remote/streaming.test.ts
import { MultiRemoteTester } from '@ssr-testing/integration/multi-remote';
import { StreamingAnalyzer } from '@ssr-testing/performance/streaming';
import { remotes, sharedContext } from './setup';

describe('Multi-Remote Streaming', () => {
  it('should stream multiple remotes with correct priorities', async () => {
    // Define streaming priorities for remotes
    const priorities = {
      header: 'critical',
      products: 'main',
      cart: 'deferred'
    };
    
    // Test streaming with remotes
    const streamingResult = await MultiRemoteTester.testStreamingComposition(
      remotes,
      sharedContext,
      { priorities }
    );
    
    // Verify streaming output
    expect(streamingResult.success).toBe(true);
    
    // Verify stream ordering
    const chunks = streamingResult.streamChunks;
    expect(chunks[0]).toContain('header-app'); // Critical should be in first chunk
    
    // Analyze streaming metrics
    const metrics = StreamingAnalyzer.analyzeStreamingResult(streamingResult);
    
    // Verify time to first byte is fast
    expect(metrics.timeToFirstByte).toBeLessThan(50);
    
    // Verify critical content is delivered quickly
    expect(metrics.timeToFirstContentfulPaint).toBeLessThan(100);
    
    // Verify shell was rendered and streamed quickly
    expect(metrics.shellRenderTime).toBeLessThan(50);
  });
});
```

### Step 5: Test Error Scenarios and Recovery

```tsx
// multi-remote/error-handling.test.ts
import { MultiRemoteTester } from '@ssr-testing/integration/multi-remote';
import { remotes, sharedContext } from './setup';

describe('Multi-Remote Error Handling', () => {
  it('should handle remote loading failures gracefully', async () => {
    // Create remote configurations with intentional failures
    const failingRemotes = {
      header: {
        ...remotes.header,
        // Simulate network failure
        simulateError: { type: 'network', message: 'Network error' }
      },
      products: remotes.products,
      cart: remotes.cart
    };
    
    // Test with error recovery enabled
    const result = await MultiRemoteTester.testServerComposition(
      failingRemotes,
      sharedContext,
      { enableFallbacks: true, retryAttempts: 2 }
    );
    
    // Verify application didn't crash
    expect(result.renderingSuccess).toBe(true);
    
    // Verify failed remote and successful ones
    expect(result.failedRemotes).toContain('header');
    expect(result.renderedRemotes).toContain('products');
    expect(result.renderedRemotes).toContain('cart');
    
    // Verify fallback content was used
    expect(result.html).toContain('Fallback header');
  });
  
  it('should handle remote runtime errors gracefully', async () => {
    // Create remote configurations with runtime errors
    const errorRemotes = {
      header: remotes.header,
      products: {
        ...remotes.products,
        // Simulate runtime error during rendering
        simulateError: { type: 'runtime', message: 'Runtime error' }
      },
      cart: remotes.cart
    };
    
    // Test with error boundaries
    const result = await MultiRemoteTester.testServerComposition(
      errorRemotes,
      sharedContext,
      { useErrorBoundaries: true }
    );
    
    // Verify application didn't crash
    expect(result.renderingSuccess).toBe(true);
    
    // Verify error was contained
    expect(result.errorBoundaryActivated).toBe(true);
    expect(result.errorBoundaryRemote).toBe('products');
    
    // Verify other remotes still rendered
    expect(result.renderedRemotes).toContain('header');
    expect(result.renderedRemotes).toContain('cart');
    
    // Verify error boundary fallback content
    expect(result.html).toContain('Something went wrong loading products');
  });
});
```

## Workflow 4: Cross-Browser SSR Testing

This workflow demonstrates how to test SSR and hydration across multiple browsers.

### Step 1: Set Up Browser Testing Environment

```typescript
// browser-testing/setup.ts
import { BrowserTester } from '@ssr-testing/integration/environment/browser-tester';
import { ProductPage } from '../src/components/ProductPage';

// Test data
export const productData = {
  id: 'test-product',
  name: 'Cross-Browser Test Product',
  description: 'This product is used for cross-browser testing',
  price: 99.99,
  images: ['/img/product.jpg'],
  variants: [
    { id: 'var-1', name: 'Small', inStock: true },
    { id: 'var-2', name: 'Medium', inStock: true },
    { id: 'var-3', name: 'Large', inStock: false }
  ]
};

// Component to test
export const testComponent = <ProductPage product={productData} />;

// Browser configurations
export const browsers = [
  {
    name: 'Chrome',
    version: 'latest',
    platform: 'desktop'
  },
  {
    name: 'Firefox',
    version: 'latest',
    platform: 'desktop'
  },
  {
    name: 'Safari',
    version: 'latest',
    platform: 'desktop'
  },
  {
    name: 'Edge',
    version: 'latest',
    platform: 'desktop'
  },
  {
    name: 'Chrome',
    version: 'latest',
    platform: 'mobile'
  },
  {
    name: 'Safari',
    version: 'latest',
    platform: 'mobile'
  }
];
```

### Step 2: Run Cross-Browser SSR and Hydration Tests

```typescript
// browser-testing/cross-browser.test.ts
import { BrowserTester } from '@ssr-testing/integration/environment/browser-tester';
import { browsers, testComponent } from './setup';

describe('Cross-Browser SSR and Hydration', () => {
  // Test each browser
  browsers.forEach(browser => {
    it(`should render and hydrate correctly in ${browser.name} on ${browser.platform}`, async () => {
      // Run browser test
      const result = await BrowserTester.testComponent(
        testComponent,
        browser
      );
      
      // Verify rendering succeeded
      expect(result.renderingSuccess).toBe(true);
      
      // Verify hydration succeeded
      expect(result.hydrationSuccess).toBe(true);
      
      // Verify no console errors
      expect(result.consoleErrors).toHaveLength(0);
      
      // Verify correct content rendering
      expect(result.content).toContain('Cross-Browser Test Product');
      expect(result.content).toContain('99.99');
      
      // Test interactive elements
      if (result.isInteractive) {
        const buttonResult = await result.clickElement('add-to-cart-button');
        expect(buttonResult.success).toBe(true);
        expect(result.updatedContent).toContain('Added to cart');
      }
    });
  });
});
```

### Step 3: Test Browser-Specific Features and Fallbacks

```typescript
// browser-testing/browser-features.test.ts
import { BrowserTester } from '@ssr-testing/integration/environment/browser-tester';
import { browsers } from './setup';
import { FeatureDetectionComponent } from '../src/components/FeatureDetectionComponent';

describe('Browser Feature Detection and Fallbacks', () => {
  browsers.forEach(browser => {
    it(`should detect features and use appropriate fallbacks in ${browser.name}`, async () => {
      // Create component with feature detection
      const component = <FeatureDetectionComponent />;
      
      // Run browser test
      const result = await BrowserTester.testComponent(
        component,
        browser
      );
      
      // Verify rendering succeeded
      expect(result.renderingSuccess).toBe(true);
      
      // Verify feature detection worked
      expect(result.features).toBeDefined();
      
      // Check browser-specific expectations
      if (browser.name === 'Safari' && browser.platform === 'mobile') {
        // Check for iOS-specific rendering
        expect(result.content).toContain('iOS-optimized view');
      }
      
      if (browser.name === 'Chrome' && browser.version === 'latest') {
        // Check for modern features support
        expect(result.features.supportsModernFeatures).toBe(true);
      }
      
      // Verify older browser fallbacks
      if (result.features.needsFallbacks) {
        expect(result.content).toContain('Using compatibility mode');
      }
    });
  });
});
```

### Step 4: Generate Browser Compatibility Report

```typescript
// browser-testing/generate-report.ts
import { BrowserCompatibilityReporter } from '@ssr-testing/reporting/browser';
import { browsers } from './setup';

async function generateBrowserReport() {
  // Collect test results for all browsers
  const results = await BrowserCompatibilityReporter.collectResults(browsers);
  
  // Generate compatibility report
  const report = BrowserCompatibilityReporter.generateReport(results);
  
  // Save HTML report
  await BrowserCompatibilityReporter.saveHtmlReport('browser-compatibility', report);
  
  // Generate compatibility score
  const score = BrowserCompatibilityReporter.calculateCompatibilityScore(results);
  
  console.log(`Browser Compatibility Score: ${score}%`);
  console.log('Report generated at: reports/browser-compatibility.html');
  
  // Print summary to console
  console.log('Browser Compatibility Summary:');
  console.log('---------------------------------');
  
  browsers.forEach(browser => {
    const browserResult = results.find(r => 
      r.browser.name === browser.name && 
      r.browser.platform === browser.platform
    );
    
    if (browserResult) {
      console.log(`${browser.name} (${browser.platform}): ${
        browserResult.issues.length > 0 
          ? `${browserResult.issues.length} issues` 
          : 'Fully compatible'
      }`);
    }
  });
}

generateBrowserReport().catch(console.error);
```

## Running the Workflows

To run these workflows, use the following commands:

### Workflow 1: Testing a New SSR Component

```bash
# Run all component tests
npm test -- --testMatch="**/MyComponent*.test.{ts,tsx}"

# Run server rendering tests only
npm test -- --testMatch="**/MyComponent.test.{ts,tsx}"

# Run hydration tests only
npm test -- --testMatch="**/MyComponent.hydration.test.{ts,tsx}"

# Run performance tests only
npm test -- --testMatch="**/MyComponent.perf.test.{ts,tsx}"

# Run E2E tests
npx playwright test e2e-tests/MyComponent.spec.ts
```

### Workflow 2: Benchmarking SSR Approaches

```bash
# Run all benchmarks
npm run benchmark

# Run individual benchmark
npm run benchmark -- --testMatch="**/traditional-ssr.bench.{ts,tsx}"

# Generate comparison report
node benchmarks/generate-report.ts
```

### Workflow 3: Testing SSR with Multiple Remotes

```bash
# Run all multi-remote tests
npm test -- --testMatch="**/multi-remote/*.test.{ts,tsx}"

# Run specific multi-remote test
npm test -- --testMatch="**/multi-remote/streaming.test.{ts,tsx}"
```

### Workflow 4: Cross-Browser SSR Testing

```bash
# Run cross-browser tests
npm run test:browser

# Generate browser compatibility report
node browser-testing/generate-report.ts
```

## Conclusion

These example workflows demonstrate how to effectively use the SSR Testing Infrastructure for a variety of common testing scenarios. By following these patterns, you can ensure your server-rendered federated components are thoroughly tested for functionality, performance, and cross-browser compatibility.

The SSR Testing Infrastructure provides a comprehensive set of tools for every aspect of SSR testing, from basic server rendering to advanced streaming and multi-remote scenarios. Use these workflows as starting points and customize them for your specific testing needs.