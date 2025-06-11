# Contributing to Zephyr Packages

Are you considering writing a zephyr plugin to help with a build tool's deployment with zephyr? Here is a checklist to help you get started quickly.

## Initial Planning

- [ ] Understand the API design of your selected build tool
  - Is it comprehensive like webpack?
  - Is it minimalist like vite/rolldown?
- [ ] Identify the essential integration points for your plugin (e.g., hooks, events - when is the build process closed?)
- [ ] Determine the type of assets you need to extract (e.g., JavaScript, CSS, images)
- [ ] Decide if you need to support module federation
  - If yes, understand how the build tool handles it
- [ ] Review similar plugins for reference

## Core Packages to Know

- [**zephyr-edge-contract**](../libs/zephyr-edge-contract/): Provides the API contract, types and interfaces, as well as small utility functions for zephyr plugins
- [**zephyr-xpack-internal**](../libs/zephyr-xpack-internal/): Contains utilities for extracting build information and handling module federation configurations
- [**zephyr-agent**](../libs/zephyr-agent): Handles communication with Zephyr's platform, including authentication, uploads, and deployment operations. Within this package take a more detailed look at [zephyr-engine](../libs/zephyr-agent/src/zephyr-engine/index.ts). **It extracts a lot of the essential logics, handle the heavy lifting for you and transform the output from desired build tool to a format where zephyr deployment process can easily understand.**

## Plugin Development Checklist

### Setup

- [ ] Create a new package in the `libs` directory
- [ ] Set up the basic package structure (package.json, tsconfig, etc.)

### Implementation

- [ ] Start zephyr-engine (it will handle the authentication and start intial build environment understanding)
- [ ] Implement process within bundler-specific hooks
  - [ ] Initialize the plugin
  - [ ] build start events
  - [ ] build end events
- [ ] Extract asset information from the build
  - [ ] Identify all assets required for deployment
  - [ ] Generate [asset maps](libs/zephyr-agent/src/lib/node-persist/partial-assets-map.ts)
- [ ] Process module federation (if applicable)
  - [ ] Extract host/remote configurations
  - [ ] Handle and replace remote dependency URLs
  - [ ] Enable runtime replacement
- [ ] Create build snapshot
  - [ ] Generate metadata about the build
  - [ ] Include dependency information
- [ ] Connect to the Zephyr agent for deployment
  - [ ] Upload assets
  - [ ] Upload snapshot
  - [ ] Upload build stats
  - [ ] Handle deployment configuration

### Testing

- [ ] Write unit tests for core functionality
- [ ] Create integration tests with a sample application
- [ ] Add your plugin to the testing matrix
- [ ] Test with different configurations and edge cases

### Documentation

- [ ] Write clear README with installation and usage instructions
- [ ] Document API options and configuration - Open PR to [zephyr-documentation](https://github.com/ZephyrCloudIO/zephyr-documentation)
- [ ] Create example application in the [examples directory](../examples/). Alternatively, if the example application might be too large, create a separate repository and link to it in the README.
- [ ] Add comments for complex logic in the code

## Creating a New Plugin: Step by Step

1. **Package Setup**

   - [ ] Create directory structure:
     ```
     libs/zephyr-[bundler]-plugin/
       ├── LICENSE
       ├── README.md
       ├── jest.config.ts
       ├── package.json
       ├── project.json
       ├── src/
       │   ├── index.ts
       │   └── lib/
       ├── tsconfig.json
       ├── tsconfig.lib.json
       └── tsconfig.spec.json
     ```
   - [ ] Set up package.json with dependencies
   - [ ] Configure TypeScript settings

2. **Core Implementation**

   - [ ] Create main plugin entry point
   - [ ] Implement bundler-specific hooks
   - [ ] Set up asset extraction logic
   - [ ] Add module federation support (if applicable)
   - [ ] Connect to zephyr-agent for deployment

3. **Examples & Testing**
   - [ ] Create example application
   - [ ] Write tests
   - [ ] Document usage patterns

## Common Integration Points

Most bundlers expose hooks at specific points. Integrate your plugin at:

- [ ] **Initialization** phase
- [ ] **Build Start** phase
- [ ] **Asset Processing** phase
- [ ] **Build End** phase
- [ ] **Deployment** phase

## Contribution Workflow

- [ ] Fork the repository
- [ ] Create a feature branch from `master`
- [ ] Implement your changes following our guidelines
- [ ] Write tests for your changes
- [ ] Update documentation
- [ ] Submit a pull request to `master`
- [ ] Respond to code review feedback

## Final Pre-Submission Checklist

- [ ] Code passes all tests
- [ ] Documentation is up-to-date
- [ ] Example application works correctly
- [ ] PR description clearly explains the changes

We appreciate your interest in contributing to Zephyr Packages! If you have questions, please open an issue in the repository.
