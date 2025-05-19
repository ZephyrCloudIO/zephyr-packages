import { createModuleFederationConfig } from "@module-federation/enhanced"

export const moduleFederationConfig = createModuleFederationConfig({
  name: "pnpm_workspace_remote",
  filename: "remoteEntry.js",
  exposes: {
    "./App": "./src/App",
  },
  shared: {
    react: {
      singleton: true,
      eager: true,
      requiredVersion: false,
    },
    "react-dom": {
      singleton: true,
      eager: true,
      requiredVersion: false,
    },
  },
})