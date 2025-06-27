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

### Git Repository Requirements

**IMPORTANT**: Zephyr requires a properly initialized Git repository with a remote origin for production deployments.

#### Git Information Handling

When Zephyr cannot find a Git repository with remote origin, it will:

1. **Interactive Terminal (TTY available)**:

   - Prompt you to manually enter organization and project names
   - Display strong warnings that this is NOT recommended
   - Show clear instructions on how to properly set up Git
   - Use custom Zephyr-branded prompts with green styling

2. **Non-Interactive Environment (CI/CD, no TTY)**:
   - Use global Git config for user information (if available)
   - Leave organization empty (will be determined from your Zephyr account)
   - Display critical warnings about potential deployment issues
   - Continue with the build but functionality may be limited

#### Example Scenarios

```bash
# Recommended: Proper Git setup
git init
git remote add origin git@github.com:YOUR_ORG/YOUR_REPO.git
git add . && git commit -m "Initial commit"
npm run build  # Works perfectly

# Interactive fallback (NOT recommended)
# No git repository, but terminal is available
npm run build
# > ⚠️  Git repository not found. Zephyr REQUIRES git...
# > PROMPT  What organization should this project belong to?
# > PROMPT  What is the project name?

# Non-interactive fallback (may cause issues)
# No git repository, no terminal (e.g., CI environment)
npm run build
# > ⚠️  CRITICAL: Git not available. Zephyr CANNOT function properly...
# > Organization will be determined from your account
```

#### Why Git is Required

Zephyr uses Git information to:

- Determine organization and project structure
- Track deployment versions and commits
- Enable collaboration features
- Provide proper deployment metadata

Without Git, Zephyr cannot guarantee proper functionality, especially for:

- Production deployments
- Team collaboration
- Version tracking
- Rollback capabilities

#### Environment Variable Fallback (AI Tools/Platforms)

For environments where Git is not available (e.g., AI coding tools like Bolt), you can provide deployment information via environment variables:

**Required Environment Variables:**

- `ZE_SECRET_TOKEN` or authenticated via CLI
- `ZEPHYR_ORG` - Your Zephyr organization name
- `ZEPHYR_PROJECT` - Your project name

**Optional Environment Variables:**

- `ZEPHYR_GIT_NAME` - Git user name (defaults to extracted token info or 'zephyr-env-deploy')
- `ZEPHYR_GIT_EMAIL` - Git user email (defaults to extracted token info or 'deploy@zephyr-cloud.io')
- `ZEPHYR_GIT_BRANCH` - Git branch name (default: 'main')

**User Information Extraction:**
When using environment variable fallback, Zephyr automatically extracts user information from your authentication token:

- **User Name**: From claims `https://api.zephyr-cloud.io/name`, `name`, `nickname`, etc.
- **User Email**: From claims `https://api.zephyr-cloud.io/email`, `email`, etc.
- **User ID**: From the `sub` claim (used in deployment tags)

This provides full accountability by:

- Using the authenticated user's name and email for Git metadata
- Adding deployment tags with the user's identity for traceability

**Example:**

```bash
export ZE_SECRET_TOKEN="your-zephyr-token"
export ZEPHYR_ORG="my-organization"
export ZEPHYR_PROJECT="my-project"
npm run build
```

This fallback is designed for AI coding platforms and similar environments where Git repositories cannot be properly initialized.

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


