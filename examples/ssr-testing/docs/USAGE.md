# SSR Testing Infrastructure: Usage Guide

This document provides comprehensive guidelines for using the Zephyr SSR Testing Infrastructure to validate and benchmark Server-Side Rendering with Module Federation.

## Getting Started

### Installation

```bash
cd examples/ssr-testing
npm install
```

### Basic Testing

Run the full test suite:

```bash
npm test
```

Run specific test types:

```bash
npm run test:renderer   # Test server rendering
npm run test:hydration  # Test client hydration
npm run test:examples   # Test integration with examples
npm run test:performance # Test performance benchmarks
npm run test:environment # Test environment compatibility
npm run test:browser    # Test browser compatibility
```

## Testing Workflows

### 1. Testing a New SSR Component

```typescript
import { SSRRenderer } from '@ssr-testing/core/renderer';
import { HydrationValidator } from '@ssr-testing/core/hydration';
import { StateComparer } from '@ssr-testing/core/state';

describe('MySSRComponent', () => {
  it('should render on the server', async () => {
    const initialState = { count: 0 };
    const result = await SSRRenderer.render(<MyComponent initialState={initialState} />);
    
    expect(result.html).toContain('count: 0');
    expect(result.errors).toHaveLength(0);
  });
  
  it('should render and capture state', async () => {
    const initialState = { count: 0, items: ['Item 1', 'Item 2'] };
    const result = await SSRRenderer.render(
      <MyComponent initialState={initialState} />, 
      { captureState: true }
    );
    
    expect(result.html).toContain('count: 0');
    expect(result.state).toBeDefined();
    expect(result.state?.count).toBe(0);
    expect(result.state?.items).toEqual(['Item 1', 'Item 2']);
    expect(result.errors).toHaveLength(0);
  });
  
  it('should hydrate correctly on the client', async () => {
    const initialState = { count: 0 };
    const serverResult = await SSRRenderer.render(<MyComponent initialState={initialState} />);
    
    const hydrationResult = await HydrationValidator.validate(
      serverResult.html,
      <MyComponent initialState={initialState} />
    );
    
    expect(hydrationResult.hydrated).toBe(true);
    expect(hydrationResult.errors).toHaveLength(0);
  });
  
  it('should maintain state consistency', async () => {
    const initialState = { count: 0 };
    const serverResult = await SSRRenderer.render(
      <MyComponent initialState={initialState} />,
      { captureState: true }
    );
    
    // Using the captured state directly
    expect(serverResult.state).toEqual(initialState);
    
    // Or using the StateComparer utility for more complex validation
    const stateConsistency = await StateComparer.compare(
      serverResult.html,
      initialState,
      'count'
    );
    
    expect(stateConsistency.consistent).toBe(true);
  });
});
```

### 2. Benchmarking Performance

```typescript
import { RenderTimer } from '@ssr-testing/performance/timing';
import { StreamingAnalyzer } from '@ssr-testing/performance/streaming';
import { BundleSizeAnalyzer } from '@ssr-testing/performance/bundle-size';

describe('Performance Benchmarks', () => {
  it('should render within performance budget', async () => {
    const component = <MyComponent initialState={{ items: generateLargeDataset() }} />;
    
    const metrics = await RenderTimer.measure(component);
    
    expect(metrics.serverRenderTime).toBeLessThan(200); // 200ms budget
    expect(metrics.clientHydrationTime).toBeLessThan(100); // 100ms budget
  });
  
  it('should optimize streaming delivery', async () => {
    const component = <MyStreamingComponent />;
    
    const streamingMetrics = await StreamingAnalyzer.analyze(component);
    
    expect(streamingMetrics.timeToFirstByte).toBeLessThan(30); // 30ms budget
    expect(streamingMetrics.timeToFirstContentfulPaint).toBeLessThan(100); // 100ms budget
  });
  
  it('should maintain bundle size budget', async () => {
    const clientBundles = [
      { name: 'main.js', size: 250000, type: 'initial' },
      { name: 'vendor.js', size: 400000, type: 'vendor' }
    ];
    
    const serverBundles = [
      { name: 'server.js', size: 300000, type: 'initial' }
    ];
    
    const bundleMetrics = BundleSizeAnalyzer.analyzeBundleSizes(clientBundles, serverBundles);
    
    expect(bundleMetrics.client.totalSize).toBeLessThan(700000); // 700KB budget
    expect(bundleMetrics.server.totalSize).toBeLessThan(400000); // 400KB budget
  });
});
```

### 3. Testing Cross-Browser Compatibility

```typescript
import { BrowserTester } from '@ssr-testing/integration/environment/browser-tester';

describe('Browser Compatibility', () => {
  it('should work in Chrome, Firefox, and Safari', async () => {
    const component = <MyComponent initialState={{ count: 0 }} />;
    
    const browsers = ['chrome', 'firefox', 'safari'];
    const results = await Promise.all(
      browsers.map(browser => BrowserTester.test(browser, component))
    );
    
    for (const result of results) {
      expect(result.renderingSuccess).toBe(true);
      expect(result.hydrationSuccess).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });
});
```

### 4. Testing Environment Compatibility

```typescript
import { PlatformTester } from '@ssr-testing/integration/environment/platform-tests';

describe('Platform Compatibility', () => {
  it('should work on different hosting platforms', async () => {
    const component = <MyComponent initialState={{ count: 0 }} />;
    
    const platforms = [
      {
        name: 'Vercel Next.js',
        environment: {
          nodeVersion: '18.x',
          os: 'linux',
          memory: 'medium',
          filesystem: 'networked'
        },
        framework: {
          server: 'next',
          client: 'react',
          bundler: 'webpack'
        }
      },
      // Add more platforms as needed
    ];
    
    const results = await Promise.all(
      platforms.map(platform => PlatformTester.testPlatform(platform, component))
    );
    
    for (const result of results) {
      expect(result.renderingSuccess).toBe(true);
      expect(result.hydrationSuccess).toBe(true);
    }
  });
});
```

## Best Practices

### 1. Component Design for Testable SSR

- **Avoid Browser-Only APIs in Server Components**: Ensure server components don't directly use browser-specific APIs like `window` or `localStorage`
- **Use Isomorphic Data Fetching**: Implement APIs that work in both server and client environments
- **Consistent State Serialization**: Ensure state can be properly serialized and hydrated
- **Clear Hydration Boundaries**: Define clear boundaries between hydrated and non-hydrated components

Example of a well-designed SSR component:

```tsx
// Good Practice
const MySSRComponent = ({ initialData }) => {
  // Use state that can be serialized
  const [data, setData] = useState(initialData);
  
  // Conditional client-side effects
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Client-only code
    }
  }, []);
  
  return (
    <div className="ssr-component">
      <h2>Server Rendered Content</h2>
      <p>{data.message}</p>
    </div>
  );
};
```

### 2. Testing Strategy

- **Test Server Rendering First**: Validate server output before testing hydration
- **Test Hydration Separately**: Focus on hydration-specific issues
- **Test With Progressive Complexity**: Start with simple components, then test more complex scenarios
- **Benchmark Critical Components**: Identify and benchmark performance-critical components

### 3. Performance Optimization

- **Minimize Server Rendering Time**: Keep server rendering time under 200ms for optimal user experience
- **Prioritize Above-the-Fold Content**: Use streaming to prioritize visible content
- **Optimize Hydration Bundle Size**: Keep hydration-specific JavaScript minimal
- **Use Selective Hydration**: Only hydrate interactive parts of the application

### 4. Error Handling

- **Implement Fallbacks**: Always provide fallback content for suspended components
- **Handle SSR-Specific Errors**: Catch and handle errors that occur during server rendering
- **Test Error Boundaries**: Validate that error boundaries work correctly in SSR context

Example of proper error handling:

```tsx
// Error boundary for SSR components
const SSRErrorBoundary = ({ children, fallback }) => {
  return (
    <ErrorBoundary 
      fallback={fallback} 
      onError={(error) => {
        // Log SSR-specific errors
        console.error('SSR Error:', error);
      }}
    >
      {children}
    </ErrorBoundary>
  );
};
```

## Integration with CI/CD

The SSR Testing Infrastructure includes a GitHub Actions workflow that:

1. Tests on multiple Node.js versions (16.x, 18.x, 20.x)
2. Runs integration tests for all examples
3. Performs performance testing
4. Generates comprehensive reports

To integrate with your own CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
name: SSR Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18.x'
      - run: cd examples/ssr-testing && npm install
      - run: cd examples/ssr-testing && npm test
      - run: cd examples/ssr-testing && npm run test:examples
      - run: cd examples/ssr-testing && npm run generate-reports
```

## Troubleshooting Common Issues

### Hydration Mismatches

If you encounter hydration mismatches between server and client rendering:

1. **Check for Dynamic Content**: Ensure date/time and other dynamic content is consistent
2. **Examine Class Names**: Different class names can cause hydration warnings
3. **Look for Missing Keys**: React lists require stable keys for proper hydration
4. **Check for Browser-Specific Code**: Server components shouldn't use browser APIs

### Performance Issues

If you encounter performance issues:

1. **Profile Server Rendering**: Use the `RenderTimer` to identify bottlenecks
2. **Analyze Bundle Sizes**: Use the `BundleSizeAnalyzer` to find oversized bundles
3. **Check Streaming Chunks**: Analyze streaming delivery with `StreamingAnalyzer`
4. **Review Hydration Time**: Look for components with excessive hydration times

## State Capture and Management

The SSR Testing Infrastructure provides robust support for capturing and validating state during server-side rendering:

```typescript
// Example component that serializes state for hydration
const MyStateComponent = ({ initialState }) => {
  // In a real component, this would use React state hooks
  const state = initialState;
  
  return (
    <div>
      <h1>State Component</h1>
      <p>Count: {state.count}</p>
      
      {/* State serialization method 1: Script tag */}
      <script
        id="__ZEPHYR_STATE__"
        type="application/json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(state)
        }}
      />
      
      {/* State serialization method 2: Data attribute */}
      <div data-zephyr-state={encodeURIComponent(JSON.stringify(state))} />
    </div>
  );
};

// Capturing state during testing
const result = await SSRRenderer.render(
  <MyStateComponent initialState={{ count: 42 }} />,
  { captureState: true }
);

// Accessing the captured state
console.log(result.state); // { count: 42 }

// Comparing with expected state
expect(result.state).toEqual({ count: 42 });
```

The state capture functionality supports two serialization methods:
1. **Script tags** with `id="__ZEPHYR_STATE__"` containing JSON data
2. **Data attributes** with `data-zephyr-state` containing URL-encoded JSON

This enables comprehensive testing of state transfer between server and client, ensuring proper hydration and state consistency.

## Advanced Usage

### Custom Test Fixtures

Create custom test fixtures for specialized testing scenarios:

```typescript
// Example: Custom test fixture for e-commerce components
export const createProductFixture = (overrides = {}) => ({
  id: 'prod-123',
  name: 'Test Product',
  price: 99.99,
  description: 'This is a test product for SSR testing',
  images: ['/img1.jpg', '/img2.jpg'],
  variants: [
    { id: 'var-1', name: 'Small', inStock: true },
    { id: 'var-2', name: 'Medium', inStock: false },
  ],
  ...overrides
});
```

### Custom Performance Metrics

Extend the testing infrastructure with custom performance metrics:

```typescript
// Example: Custom metric for measuring time to load dynamic data
export const measureDataLoadingTime = async (component, dataUrl) => {
  const start = performance.now();
  
  // Render the component with data loading
  const result = await SSRRenderer.render(component);
  
  // Wait for data loading to complete
  await waitForDataLoading(result.html, dataUrl);
  
  const end = performance.now();
  
  return {
    totalLoadingTime: end - start,
    html: result.html,
    errors: result.errors
  };
};
```

### Integration with Zephyr Examples

The SSR Testing Infrastructure works seamlessly with all Zephyr SSR examples:

- **Basic Next.js SSR**: Simple host-remote SSR setup
- **Multi-Remote SSR**: Multiple remotes with shared state
- **Hybrid SSR/CSR**: Progressive enhancement patterns
- **Streaming SSR**: React 18+ streaming capabilities

To test a specific example:

```bash
cd examples/ssr-testing
npm run test:examples -- -t "Basic Next.js SSR"
```

## Conclusion

The SSR Testing Infrastructure provides comprehensive tools for validating, benchmarking, and optimizing Server-Side Rendering with Module Federation. By following these guidelines and best practices, you can ensure your federated SSR implementation is robust, performant, and compatible across environments.