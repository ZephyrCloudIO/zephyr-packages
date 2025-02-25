# Zephyr Internal Plugin Architecture

This package contains the shared architecture for all Zephyr bundler plugins. It provides a common foundation to ensure consistent behavior and code reuse across different bundler integrations.

Read more from our documentation [here](https://docs.zephyr-cloud.io).

## Architecture Overview

The architecture is based on a core abstract class `ZeBasePlugin` that defines the common plugin behavior. Specific bundler plugins extend this class to implement bundler-specific logic.

```mermaid
classDiagram
    class ZeBasePlugin {
        <<abstract>>
        #options: ZeInternalPluginOptions
        #bundlerType: ZeBundlerType
        #pluginName: string
        +constructor(options, bundlerType)
        #initialize(): Promise~void~
        #abstract processAssets(): Promise~ZeProcessAssetsResult~
        #log(message): void
        #logError(message): void
        #logWarning(message): void
        #static createOptions~T~(userOptions, defaults): T
    }

    class ZeWebpackPlugin {
        +constructor(options)
        +apply(compiler): void
        #processAssets(): Promise~ZeProcessAssetsResult~
    }

    class ZeRspackPlugin {
        +constructor(options)
        +apply(compiler): void
        #processAssets(): Promise~ZeProcessAssetsResult~
    }

    class ZeVitePlugin {
        +constructor(options)
        +configResolved(config): void
        #processAssets(assets, outputPath): Promise~ZeProcessAssetsResult~
    }

    class ZeRollupPlugin {
        +constructor(options)
        +getRollupPlugin(): Plugin
        #processAssets(): Promise~ZeProcessAssetsResult~
    }

    class ZeRolldownPlugin {
        +constructor(options)
        +getRolldownPlugin(): Plugin
        #processAssets(): Promise~ZeProcessAssetsResult~
    }

    class ZeRepackPlugin {
        +constructor(options)
        +apply(compiler): void
        #processAssets(): Promise~ZeProcessAssetsResult~
    }

    ZeBasePlugin <|-- ZeWebpackPlugin
    ZeBasePlugin <|-- ZeRspackPlugin
    ZeBasePlugin <|-- ZeVitePlugin
    ZeBasePlugin <|-- ZeRollupPlugin
    ZeBasePlugin <|-- ZeRolldownPlugin
    ZeBasePlugin <|-- ZeRepackPlugin
```

## Plugin Lifecycle

The following diagram illustrates the typical lifecycle of a Zephyr plugin:

```mermaid
sequenceDiagram
    participant User
    participant withZephyr
    participant ZephyrEngine
    participant BundlerPlugin
    participant ZeBasePlugin

    User->>withZephyr: Configure bundler
    withZephyr->>ZephyrEngine: Create engine
    withZephyr->>BundlerPlugin: Create plugin instance
    BundlerPlugin->>ZeBasePlugin: Call super constructor
    ZeBasePlugin-->>BundlerPlugin: Initialize base plugin
    withZephyr->>User: Return enhanced config

    Note over User,ZeBasePlugin: During build process

    User->>BundlerPlugin: Build starts
    BundlerPlugin->>ZeBasePlugin: initialize()
    BundlerPlugin->>ZephyrEngine: Set up build properties

    Note over User,ZeBasePlugin: Asset processing

    BundlerPlugin->>ZeBasePlugin: processAssets()
    ZeBasePlugin->>BundlerPlugin: Call processAssets implementation
    BundlerPlugin->>ZephyrEngine: Upload assets
    ZephyrEngine-->>BundlerPlugin: Assets processed
    BundlerPlugin-->>User: Build complete
```

## Architecture Components

### ZeBasePlugin

The abstract base class that defines the common interface and behavior for all Zephyr plugins. It provides:

- Common initialization logic
- Logging utilities
- Abstract `processAssets` method that must be implemented by subclasses
- Type safety through generic parameters

### Bundler-Specific Plugins

Each bundler has its own plugin implementation that extends `ZeBasePlugin`:

- `ZeWebpackPlugin`: For webpack integration
- `ZeRspackPlugin`: For Rspack integration
- `ZeVitePlugin`: For Vite integration
- `ZeRollupPlugin`: For Rollup integration
- `ZeRolldownPlugin`: For Rolldown integration
- `ZeRepackPlugin`: For React Native Repack integration

### withZephyr Factory Functions

Each plugin provides a `withZephyr` factory function that:

1. Creates a ZephyrEngine instance
2. Handles Module Federation dependencies (if applicable)
3. Creates the appropriate plugin instance
4. Enhances the bundler configuration

```mermaid
flowchart TD
    A[User Code] -->|"import { withZephyr }"| B[withZephyr factory]
    B -->|"return function"| C[Configuration enhancer]
    C -->|"Create ZephyrEngine"| D[ZephyrEngine]
    C -->|"Extract dependencies"| E[Module Federation config]
    E -->|"Resolve remotes"| F[Resolved dependencies]
    C -->|"Create plugin instance"| G[Bundler plugin]
    G -->|"extends"| H[ZeBasePlugin]
    C -->|"Return enhanced config"| I[Enhanced bundler config]
```

## Plugin Integration Diagram

This diagram shows how the plugins integrate with the bundler and the Zephyr Cloud:

```mermaid
flowchart TB
    subgraph "Bundler Environment"
        A[User Application] -->|"Configure with withZephyr"| B[Bundler]
        B -->|"Use"| C[Zephyr Plugin]
        C -->|"extends"| D[ZeBasePlugin]
    end

    subgraph "Zephyr Agent"
        E[ZephyrEngine]
    end

    subgraph "Zephyr Cloud"
        F[API Service]
        G[Asset Storage]
    end

    C -->|"Use"| E
    E -->|"Upload assets"| F
    F -->|"Store"| G

    classDef userCode fill:#d4f0f0,stroke:#0d8e8e
    classDef bundler fill:#f0e3d4,stroke:#8e6d0d
    classDef plugin fill:#d4f0d9,stroke:#0d8e3e
    classDef agent fill:#f0d4e7,stroke:#8e0d6d
    classDef cloud fill:#d4dff0,stroke:#0d5a8e

    class A userCode
    class B bundler
    class C,D plugin
    class E agent
    class F,G cloud
```

## Type System

The plugin architecture uses a robust type system to ensure type safety and consistency:

```mermaid
classDiagram
    class ZePluginOptions {
        <<interface>>
        +wait_for_index_html?: boolean
        +mfConfig?: unknown
    }

    class ZeInternalPluginOptions {
        <<interface>>
        +zephyr_engine: unknown
        +pluginName: string
        +mfConfig?: unknown
        +wait_for_index_html?: boolean
    }

    class ZeBundlerType {
        <<type>>
        webpack
        rspack
        repack
        vite
        rollup
        rolldown
        unknown
    }

    class ZeProcessAssetsResult {
        <<interface>>
        +success: boolean
        +error?: string
    }

    class ZeBuildAsset {
        <<interface>>
        +name: string
        +source: string | Buffer
        +size: number
    }

    class BundlerSpecificOptions {
        <<interface>>
        ...bundler-specific options
    }

    ZePluginOptions <|-- BundlerSpecificOptions
    ZeInternalPluginOptions <|-- BundlerSpecificInternalOptions

    class BundlerSpecificInternalOptions {
        <<interface>>
        +zephyr_engine: ZephyrEngine
        ...bundler-specific options
    }
```

## Usage Example

Here's how a user would typically integrate a Zephyr plugin with their bundler configuration:

```typescript
// For webpack
import { withZephyr } from 'zephyr-webpack-plugin';

const webpackConfig = {
  // webpack configuration
};

// Enhance the configuration with Zephyr
export default withZephyr({
  wait_for_index_html: true,
  // Other Zephyr options
})(webpackConfig);

// For Vite
import { withZephyr } from 'vite-plugin-zephyr';

export default {
  plugins: [
    withZephyr({
      wait_for_index_html: true,
      // Other Zephyr options
    }),
    // Other Vite plugins
  ],
  // Other Vite configuration
};
```

## Benefits of the Architecture

- **Code Reuse**: The common logic is defined once in the base class
- **Consistency**: All plugins behave the same way with the same lifecycle
- **Type Safety**: Strong typing ensures correct usage
- **Maintainability**: Changes to the common logic only need to be made in one place
- **Extensibility**: New bundler integrations can be added easily by extending the base class
