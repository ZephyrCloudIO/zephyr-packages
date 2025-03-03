# SSR Testing Infrastructure

This directory contains the testing infrastructure for Server-Side Rendering (SSR) with Module Federation in the Zephyr package system. The infrastructure provides tools for validating SSR functionality, measuring performance, and ensuring the reliability of SSR implementations.

## Structure

- `/core` - Core testing utilities
  - `/renderer` - Server-side rendering utilities
  - `/hydration` - Client hydration validation tools
  - `/state` - State comparison and validation utilities
  - `/snapshots` - Snapshot testing utilities
  - `/errors` - Error boundary testing utilities

- `/performance` - Performance measurement tools
  - `/timing` - Rendering and hydration timing utilities
  - `/resources` - Resource loading analysis tools
  - `/streaming` - Streaming analysis utilities
  - `/bundle-size` - Bundle size analysis tools

- `/fixtures` - Test fixtures and mocks
  - `/components` - Component fixtures with varying complexity
  - `/state` - State fixtures for testing state transfer
  - `/network` - Network condition simulators

- `/integration` - Integration testing with different frameworks
  - `/next` - Next.js integration tests
  - `/remix` - Remix integration tests

- `/reporting` - Reporting and visualization tools
  - `/dashboard` - Performance dashboard
  - `/comparison` - Comparison tools for different approaches
  - `/regression` - Regression detection utilities

## Getting Started

1. Install dependencies:
   ```
   npm install
   ```

2. Run tests:
   ```
   npm test
   ```

3. Run specific test suites:
   ```
   npm run test:renderer   # Run renderer tests
   npm run test:hydration  # Run hydration tests
   npm run test:examples   # Run integration tests with examples
   ```

4. Run performance tests:
   ```
   npm run test:performance
   ```

## Usage

The SSR Testing Infrastructure provides tools for testing different aspects of SSR functionality:

### Server-Side Rendering

```typescript
import { SSRRenderer } from '@core/renderer';

const html = await SSRRenderer.render(<MyComponent />);
expect(html).toContain('expected-content');
```

### Hydration Validation

```typescript
import { HydrationValidator } from '@core/hydration';

const result = await HydrationValidator.validate(html, <MyComponent />);
expect(result.hydrated).toBe(true);
```

### Performance Measurement

```typescript
import { RenderTimer } from '@performance/timing';

const metrics = await RenderTimer.measure(<MyComponent />);
expect(metrics.totalTime).toBeLessThan(100); // 100ms
```

## Integration with Examples

The SSR Testing Infrastructure can be used to test the SSR examples:

- Basic Next.js SSR Example (`/examples/nextjs-ssr-basic`)
- Multi-Remote SSR Example (`/examples/multi-remote-ssr`)
- Hybrid SSR/CSR Example (`/examples/hybrid-ssr-csr`)
- Streaming SSR Example (`/examples/streaming-ssr`)

## Contributing

When adding new test utilities or fixtures, please follow these guidelines:

1. Add comprehensive test coverage for all utilities
2. Document usage with examples
3. Ensure compatibility with different environments
4. Follow the existing patterns and naming conventions

## Documentation

For more detailed documentation, see the following files:

- `/context-storage/ssr-testing-infrastructure-plan.md` - Detailed implementation plan
- `/context-storage/phase4-ssr-examples-plan.md` - SSR examples and testing plan