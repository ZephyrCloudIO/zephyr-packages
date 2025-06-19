# Zephyr Agent (Internal)

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

**Internal Package** - The main internal package that provides the Zephyr agent for bundler plugins. This package contains the core functionality for deployment, asset management, and communication with Zephyr Cloud.

> **Note**: This is an internal package used by other Zephyr plugins. It is not intended for direct use by end users.

## Overview

The Zephyr Agent is the core engine that powers all Zephyr bundler plugins. It provides:

- **Deployment Pipeline**: Handles the complete deployment workflow to Zephyr Cloud
- **Asset Management**: Optimizes and manages build assets for edge distribution
- **Authentication**: Manages secure communication with Zephyr Cloud services
- **Build Context**: Provides build-time context and metadata for plugins
- **Edge Communication**: Handles communication with Zephyr's edge network

## Architecture

The agent is structured into several key modules:

### Authentication (`lib/auth/`)

- Handles user authentication and authorization
- Manages API tokens and session management
- Provides WebSocket connections for real-time updates

### Build Context (`lib/build-context/`)

- Extracts build metadata and package information
- Provides Git integration and repository context
- Manages dependency resolution and parsing

### Deployment (`lib/deployment/`)

- Implements deployment strategies for different CDN providers
- Supports Cloudflare, Fastly, and Netlify deployment targets
- Handles asset uploads and build stats publication

### Edge Actions (`lib/edge-actions/`)

- Manages deployment operations on edge infrastructure
- Handles snapshot creation and environment enabling
- Coordinates asset uploads and build statistics

### HTTP Layer (`lib/http/`)

- Provides HTTP client functionality with retries
- Handles file uploads and API communication
- Manages request/response lifecycle

## Usage by Plugins

Public Zephyr plugins interact with the agent through well-defined APIs:

```typescript
import { ZephyrAgent } from 'zephyr-agent';

// Initialize the agent
const agent = new ZephyrAgent({
  buildContext: buildInfo,
  assets: assetMap,
});

// Deploy to Zephyr Cloud
await agent.deploy();
```

## Dependencies

The agent has minimal external dependencies:

- **Core Dependencies**: Node.js built-ins and essential utilities
- **Network**: HTTP client libraries for API communication
- **File System**: Asset management and build context extraction
- **Crypto**: Secure token management and validation

## Configuration

The agent is configured through build context and environment variables:

```typescript
interface ZephyrAgentConfig {
  buildContext: BuildContext;
  assets: AssetMap;
  deploymentOptions?: DeploymentOptions;
  authentication?: AuthConfig;
}
```

### Git Repository Detection

When deploying from a directory that is not a Git repository, Zephyr will attempt the following fallbacks in order:

1. **Local Git Repository** - Uses git info from the current repository
2. **Global Git Config** - Falls back to global git user config and auto-generates an organization name
3. **Anonymous Mode** - Creates a machine-specific organization for anonymous users

**Note**: When git is not available, Zephyr will display warnings indicating this is fallback behavior.

#### Auto-Generated Organization Names

Zephyr generates unique organization names in different scenarios:

1. **With Global Git Config**: Organization name is derived from the user's email address

   - Example: `john-doe-a1b2c3d4` (username + hash of email)
   - Consistent across projects for the same user email

2. **Anonymous Users (No Git)**: Organization name is derived from machine-specific data

   - Example: `anonymous-f3e4b2a1` (anonymous + machine hash)
   - Unique per machine, consistent on the same machine
   - Prevents conflicts between different anonymous users

#### Example Usage

```bash
# With a git repository (recommended)
git init
git remote add origin git@github.com:USERNAME_OR_ORG/YOUR_REPO.git
npm run build  # Will use your GitHub org/username

# With global git config (fallback)
git config --global user.name "John Doe"
git config --global user.email "john@example.com"
npm run build  # Will use auto-generated org: john-a1b2c3d4

# Without any git config (anonymous)
npm run build  # Will use machine-specific org: anonymous-f3e4b2a1
```

This allows Zephyr to work in environments without Git, such as:

- CI/CD pipelines without Git history
- Standalone build directories
- Ephemeral development environments
- Quick prototypes and demos

## Internal APIs

### Build Context API

```typescript
// Extract package.json information
const packageInfo = await readPackageJson(projectRoot);

// Get Git repository information
const gitInfo = await getGitInfo();

// Parse Zephyr dependencies
const deps = parseZephyrDependencies(packageJson);
```

### Deployment API

```typescript
// Upload assets to CDN
await uploadAssets(assets, uploadStrategy);

// Enable environment on edge
await enableSnapshotOnEdge(snapshotId);

// Upload build statistics
await uploadBuildStats(buildStats);
```

## Integration Points

The agent integrates with:

- **Bundler Plugins**: Receives build assets and metadata
- **Zephyr Cloud**: Deploys assets and manages deployments
- **CDN Providers**: Uploads assets to edge locations
- **Git Providers**: Extracts repository and commit information

## Development

For plugin developers working on Zephyr integrations:

```bash
# Build the agent
npm run build

# Run tests
npm run test

# Development mode
npm run dev
```

## Security

The agent implements several security measures:

- **Token Management**: Secure storage and rotation of API tokens
- **Encrypted Communication**: All API communication uses HTTPS/WSS
- **Input Validation**: Validates all build inputs and configurations
- **Access Control**: Role-based access to deployment operations

## Contributing

This is an internal package. Contributions should be made through the main Zephyr plugins repository. Please read our [contributing guidelines](../../CONTRIBUTING.md) for more information.

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.
