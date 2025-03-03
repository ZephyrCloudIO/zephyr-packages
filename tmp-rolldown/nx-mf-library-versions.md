# Managing Library Versions with Module Federation in Nx

## Introduction

When using Module Federation in a micro-frontend architecture, managing shared libraries efficiently is crucial for performance and consistency. Module Federation allows you to share libraries across different applications to avoid duplicating code and ensure consistent behavior.

## Shared Library Configuration

### Basic Configuration

Module Federation provides the `shared` property to define which libraries should be shared across applications:

```javascript
// webpack.config.js
const moduleFederationConfig = {
  name: 'host',
  remotes: ['remote1', 'remote2'],
  shared: {
    // Basic shared configuration
    react: {},
    'react-dom': {},
    '@my-org/ui-components': {}
  }
};
```

### Advanced Configuration

The `shared` configuration supports several options to fine-tune how libraries are shared:

```javascript
// webpack.config.js
const moduleFederationConfig = {
  name: 'host',
  remotes: ['remote1', 'remote2'],
  shared: {
    // Advanced shared configuration
    react: { 
      singleton: true,
      requiredVersion: '^17.0.0',
      eager: true
    },
    'react-dom': { 
      singleton: true,
      requiredVersion: '^17.0.0',
      eager: true
    },
    '@my-org/ui-components': {
      singleton: true,
      requiredVersion: '~2.3.0'
    }
  }
};
```

## Shared Configuration Properties

### 1. `singleton`

Ensures only one instance of the library is used across all federated applications.

```javascript
shared: {
  react: { 
    singleton: true 
  }
}
```

- **true**: Only one instance of the library is used, regardless of version
- **false**: Different versions can co-exist (can lead to unexpected behaviors)

### 2. `requiredVersion`

Specifies the version or version range that the application requires.

```javascript
shared: {
  react: { 
    requiredVersion: '^17.0.0' 
  }
}
```

Support for semantic versioning:
- Exact: `"17.0.0"`
- Range: `"^17.0.0"` (anything compatible with 17.0.0)
- Range: `"~17.0.0"` (any 17.0.x version)
- Any: `"*"` (any version)

### 3. `eager`

Controls whether a shared module is included in the initial bundle.

```javascript
shared: {
  react: { 
    eager: true 
  }
}
```

- **true**: Library is included in the initial bundle
- **false**: Library is loaded asynchronously when needed

### 4. `strictVersion`

Determines whether version mismatches should cause errors.

```javascript
shared: {
  react: { 
    strictVersion: true,
    requiredVersion: '^17.0.0' 
  }
}
```

- **true**: Throws an error if versions don't match
- **false**: Uses available version even if it doesn't match requirements

### 5. `shareScope`

Defines a namespace for shared modules, allowing multiple sharing contexts.

```javascript
shared: {
  react: { 
    shareScope: 'default'
  }
}
```

## Nx-Specific Features

### Auto Version Resolution

Nx can automatically determine and set the `requiredVersion` based on the versions used in your workspace:

```javascript
// webpack.config.js
const { composePlugins, withNx, withModuleFederation } = require('@nx/webpack');
const { dependencies } = require('../../package.json');

const moduleFederationConfig = {
  // ...
  shared: (libraryName) => {
    // Auto version resolution
    if (dependencies[libraryName]) {
      return {
        singleton: true,
        requiredVersion: dependencies[libraryName]
      };
    }
    return {};
  }
};
```

### Simplified `shared` Configuration

Nx provides a helper function to create shared configurations with smart defaults:

```javascript
// webpack.config.js using Nx helper
const { sharedMappings } = require('./module-federation.config');

const moduleFederationConfig = {
  // ...
  shared: {
    ...sharedMappings,
    
    // You can still add manual configurations
    react: { singleton: true, eager: true },
    'react-dom': { singleton: true, eager: true }
  }
};
```

## Version Resolution Strategy

When multiple versions of a shared library are available, Module Federation uses this resolution strategy:

1. If the library is marked as `singleton`:
   - First preference: The highest version that satisfies all requirements
   - Second preference: The version from the application that loaded first

2. If the library is not a `singleton`:
   - Each application uses its own version
   - Can lead to multiple instances of the same library

## Common Version Management Patterns

### 1. Host-Provided Libraries

Host application provides critical libraries to all remotes:

```javascript
// Host webpack.config.js
const moduleFederationConfig = {
  name: 'host',
  shared: {
    react: { singleton: true, eager: true },
    'react-dom': { singleton: true, eager: true },
    '@my-org/core': { singleton: true, eager: true }
  }
};

// Remote webpack.config.js
const moduleFederationConfig = {
  name: 'remote',
  shared: {
    react: { singleton: true, requiredVersion: '^17.0.0' },
    'react-dom': { singleton: true, requiredVersion: '^17.0.0' },
    '@my-org/core': { singleton: true }
  }
};
```

### 2. Peer Sharing

All applications declare what they're willing to share:

```javascript
// All applications use this pattern
const moduleFederationConfig = {
  name: 'app-name',
  shared: {
    react: { singleton: true, requiredVersion: '^17.0.0' },
    'react-dom': { singleton: true, requiredVersion: '^17.0.0' }
  }
};
```

### 3. Federated Libraries

Libraries themselves are federated modules:

```javascript
// Library webpack.config.js
const moduleFederationConfig = {
  name: 'ui-library',
  exposes: {
    './Button': './src/components/Button',
    './Card': './src/components/Card'
  },
  shared: {
    react: { singleton: true, requiredVersion: '^17.0.0' }
  }
};
```

## Best Practices

### 1. Version Alignment

Keep versions of related libraries in sync:

```javascript
shared: {
  react: { singleton: true, requiredVersion: '^17.0.0' },
  'react-dom': { singleton: true, requiredVersion: '^17.0.0' }
}
```

### 2. Singleton for Stateful Libraries

Always use `singleton: true` for libraries that maintain state or use global objects:

```javascript
shared: {
  react: { singleton: true },
  redux: { singleton: true },
  'react-router': { singleton: true }
}
```

### 3. Eager Loading Critical Libraries

Use `eager: true` for libraries needed immediately:

```javascript
shared: {
  react: { singleton: true, eager: true },
  'react-dom': { singleton: true, eager: true }
}
```

### 4. Explicit Version Requirements

Be specific about version requirements to prevent subtle bugs:

```javascript
shared: {
  // Explicit versions are better than automatic resolution
  lodash: { singleton: true, requiredVersion: '4.17.21' }
}
```

## Troubleshooting

### 1. Multiple Instances

**Symptom**: Library functions not working correctly, React context not working across boundaries.

**Solution**: Ensure `singleton: true` is set for the problematic library in all applications.

### 2. Version Mismatch

**Symptom**: Unexpected errors or behaviors.

**Solution**: Use compatible versions or set more specific `requiredVersion` ranges.

### 3. Loading Issues

**Symptom**: Libraries not loading correctly in some cases.

**Solution**: Consider setting `eager: true` for critical dependencies.

## Example: Complete Configuration

```javascript
// webpack.config.js
const { composePlugins, withNx, withModuleFederation } = require('@nx/webpack');
const { dependencies } = require('../../package.json');

// Helper function for basic shared libraries
function shareAll(libs) {
  return libs.reduce((acc, lib) => {
    acc[lib] = { 
      singleton: true,
      requiredVersion: dependencies[lib] 
    };
    return acc;
  }, {});
}

const frameworkLibs = ['react', 'react-dom', 'react-router-dom'];
const uiLibs = ['@my-org/ui', '@my-org/icons', '@my-org/theme'];

const moduleFederationConfig = {
  name: 'host',
  remotes: ['remote1', 'remote2'],
  shared: {
    // Framework libraries (eager loaded)
    ...frameworkLibs.reduce((acc, lib) => {
      acc[lib] = { 
        singleton: true, 
        eager: true,
        requiredVersion: dependencies[lib] 
      };
      return acc;
    }, {}),
    
    // UI component libraries
    ...shareAll(uiLibs)
  }
};

module.exports = composePlugins(
  withNx(),
  withModuleFederation(moduleFederationConfig)
);
```