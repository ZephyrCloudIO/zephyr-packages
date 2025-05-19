import { createModuleFederationConfig } from "@module-federation/enhanced"

export const moduleFederationConfig = createModuleFederationConfig({
  name: "host",
  filename: "remoteEntry.js",
  remotes: {
    remote: "remote@http://localhost:3001/remoteEntry.js",
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