# SSR Testing Infrastructure Documentation

This directory contains comprehensive documentation for the Zephyr SSR Testing Infrastructure.

## Recent Enhancements

- **State Capture**: Added robust state capture and validation functionality
- **Environment Testing**: Added comprehensive testing across Node.js versions and browsers
- **Platform Compatibility**: Added framework-specific testing for different hosting platforms

## Documentation Files

### [Usage Guide](./USAGE.md)
Provides a detailed guide on how to use the SSR Testing Infrastructure, including:
- Installation and setup
- Available testing utilities
- Performance measurement tools
- Integration with CI/CD pipelines
- Troubleshooting common issues

### [SSR Patterns and Best Practices](./SSR_PATTERNS.md)
Detailed documentation of SSR patterns and best practices with Module Federation:
- Core SSR patterns (Basic SSR, Multi-Remote Composition, Progressive Hydration, Streaming SSR)
- Advanced SSR patterns (Partial Hydration, Hybrid SSR/CSR, State Rehydration, SSR with Micro-Frontends)
- Performance optimization strategies
- Debugging and troubleshooting guide

### [Example Workflows](./EXAMPLE_WORKFLOWS.md)
Step-by-step workflows for common testing scenarios:
- Testing a new SSR component
- Benchmarking different SSR approaches
- Testing SSR with multiple remotes
- Cross-browser SSR testing

## Example Applications

The SSR Testing Infrastructure works with the following example applications:

- [Basic Next.js SSR Example](/examples/nextjs-ssr-basic/)
- [Multi-Remote SSR Example](/examples/multi-remote-ssr/)
- [Hybrid SSR/CSR Example](/examples/hybrid-ssr-csr/)
- [Streaming SSR Example](/examples/streaming-ssr/)

## Getting Started

To get started with the SSR Testing Infrastructure:

1. Read the [Usage Guide](./USAGE.md)
2. Explore the [Example Workflows](./EXAMPLE_WORKFLOWS.md)
3. Learn about best practices in [SSR Patterns](./SSR_PATTERNS.md)
4. Run the tests on the example applications

## Contributing

When contributing to the SSR Testing Infrastructure, please follow these guidelines:

1. Follow the existing code style and patterns
2. Write tests for new functionality
3. Update documentation when adding new features
4. Run the full test suite before submitting changes
5. Add examples that demonstrate new features or patterns