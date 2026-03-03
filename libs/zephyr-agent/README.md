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

1. **Automatic Package.json-Based Naming**:

   - Extract organization, project, and app names from your `package.json`
   - Use authenticated user's username as the organization for personal Zephyr org
   - Follow intelligent naming conventions based on package structure
   - No user prompts or environment variables required

2. **Enhanced Naming Logic**:
   - **Scoped packages** (`@scope/name`): project = scope, app = name
   - **With root package.json**:
     - If root is scoped (`@scope/name`): project = scope, app = current package name
     - Otherwise: project = root package name, app = current package name
   - **Fallback to directory name**: If no root package.json found, uses directory name as project
   - **Single package**: project = app = package name
   - **Organization**: Uses authenticated user's username (sanitized for URL safety)

#### Example Scenarios

```bash
# Recommended: Proper Git setup (required for CI)
git init
git remote add origin git@github.com:YOUR_ORG/YOUR_REPO.git
git add . && git commit -m "Initial commit"
npm run build  # Works perfectly with full Git context

# Local-only metadata mode (no commit yet)
git init
git remote add origin git@github.com:YOUR_ORG/YOUR_REPO.git
npm run build  # Works for local builds; CI still requires commit history

# Automatic fallback (works seamlessly)
# No git repository - uses package.json naming
npm run build  # Automatically determines naming from package.json

# Examples of automatic naming:
# package.json: { "name": "@my-company/my-app" }
# → org: "jwt-username", project: "my-company", app: "my-app"

# package.json: { "name": "my-project" } (no root package.json)
# → org: "jwt-username", project: "my-project", app: "my-project"

# package.json: { "name": "my-app" } (root package.json: { "name": "my-workspace" })
# → org: "jwt-username", project: "my-workspace", app: "my-app"

# package.json: { "name": "my-app" } (root package.json: { "name": "@company/monorepo" })
# → org: "jwt-username", project: "company", app: "my-app"

# package.json: { "name": "my-app" } (no root package.json found)
# → org: "jwt-username", project: "current-directory-name", app: "my-app"

# Special characters in username get sanitized:
# Username: "Néstor López" → org: "n-stor-l-pez"
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

#### Package.json-Based Naming (Non-Git Environments)

When Git is not available (e.g., AI coding tools, quick prototypes), Zephyr automatically extracts naming information from your `package.json` structure:

**Automatic Organization Detection:**

- Uses the authenticated user's name from your authentication token
- Requires valid authentication to determine organization

**Project and App Naming Logic:**

1. **Scoped Package** (`@company/app-name`):

   - Project: `company` (scope without @)
   - App: `app-name`

2. **Monorepo Structure** (root `package.json` exists):

   - If root is scoped (`@company/monorepo`): Project = `company`, App = current package name
   - Otherwise: Project = root package name, App = current package name
   - If no root package.json found: Project = current directory name, App = current package name

3. **Single Package**:
   - Project: Package name
   - App: Package name

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
