# Setup Patterns

Use this file when the user asks how to configure a host or remote with Zephyr and Module Federation.

## Two layers to explain

1. Bundler/module federation config
2. `zephyr:dependencies` mapping in `package.json`

Both are needed for a smooth Zephyr MF workflow.

## Smallest end-to-end path

1. Configure the remote with valid MF `name`, `filename`, and `exposes`.
2. Configure the host with matching remote keys/names.
3. Add `zephyr:dependencies` in the host `package.json`.
4. Build the remote first so Zephyr can resolve it.
5. Build the host and verify the host can load/import the remote.

## Lifecycle map

- Build time: bundler MF config is compiled and Zephyr captures dependency declarations.
- Deploy time: Zephyr resolves remote selectors to concrete deploy targets.
- Runtime: the host loads the resolved remote entry and executes the remote code.

## Naming map

Keep these aligned:

- remote package `name`
- remote MF config `name`
- host remote key / import name
- `zephyr:dependencies` local key
- `zephyr:dependencies` target app identifier when not using `workspace:*`

If names drift, users often get confusing resolution or runtime-load failures.

## Vite host example

File: `https://github.com/ZephyrCloudIO/zephyr-examples/blob/main/module-federation/react-vite-rspack-webpack/host/vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { withZephyr, type ModuleFederationOptions } from 'vite-plugin-zephyr';

const mfConfig: ModuleFederationOptions = {
  name: 'vite-host',
  filename: 'remoteEntry.js',
  remotes: {
    vite_remote: {
      name: 'vite_remote',
      entry: 'http://localhost:5174/remoteEntry.js',
      type: 'module',
    },
    vite_webpack: {
      name: 'vite_webpack',
      entry: 'http://localhost:8080/remoteEntry.js',
      type: 'var',
    },
    vite_rspack: {
      name: 'vite_rspack',
      entry: 'http://localhost:8081/remoteEntry.js',
      type: 'var',
    },
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
  },
};

export default defineConfig({
  plugins: [react(), withZephyr({ mfConfig })],
});
```

## Minimal remote example

File: `https://docs.zephyr-cloud.io/bundlers/vite.md`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { withZephyr, type ModuleFederationOptions } from 'vite-plugin-zephyr';

const mfConfig: ModuleFederationOptions = {
  name: 'remote-app',
  filename: 'remoteEntry.js',
  exposes: {
    './Button': './src/components/Button',
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
  },
};

export default defineConfig({
  plugins: [react(), withZephyr({ mfConfig })],
});
```

## Host dependency mapping

File: `https://github.com/ZephyrCloudIO/zephyr-examples/blob/main/module-federation/react-vite-rspack-webpack/host/package.json`

```json
"zephyr:dependencies": {
  "vite_remote": "workspace:*",
  "vite_rspack": "workspace:*",
  "vite_webpack": "workspace:*"
}
```

## What to explain

- Local import names must line up with the names the host uses.
- `zephyr:dependencies` tells Zephyr how to resolve those remotes at build/runtime.
- Shared React deps are usually singleton.
- In mixed-bundler Vite hosts, remote `type` matters.
- `type: 'module'` usually matches module-style Vite remotes; `type: 'var'` usually matches Webpack/Rspack-style remotes.
- Host and remote still need valid MF config even when Zephyr handles deploy-time resolution.

## Minimal code mental model

- Host code imports/loads the remote by the host's configured remote key.
- Zephyr helps resolve where that remote should come from in deployed environments.
