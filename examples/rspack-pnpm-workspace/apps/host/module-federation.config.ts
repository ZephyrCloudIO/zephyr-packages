import { createModuleFederationConfig } from "@module-federation/enhanced"

export const moduleFederationConfig = createModuleFederationConfig({
  name: "pnpm_workspace_host",
  filename: "remoteEntry.js",
  remotes: {
    remote: "pnpm_workspace_remote@http://localhost:3001/remoteEntry.js",
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