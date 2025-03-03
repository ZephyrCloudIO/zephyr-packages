# Remote Metadata Host Application

This is a Next.js application that demonstrates the Remote Entry Structure Sharing functionality from the Zephyr Module Federation project.

## Features

- Consumes three remote applications (SSR, CSR, and hybrid)
- Validates compatibility with remote applications
- Displays remote components with appropriate rendering strategies
- Shows detailed compatibility information and warnings

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Implementation Details

This host application uses the `RemoteStructureSharingIntegration` to:

1. Fetch metadata from remote applications
2. Validate compatibility between host and remotes
3. Apply appropriate rendering strategies based on remote types
4. Provide clear feedback about compatibility issues

## Remote Applications

This host consumes three remote applications:

1. **Remote A**: A Next.js (SSR) application serving server-rendered components
2. **Remote B**: A Vite (CSR) application serving client-rendered components  
3. **Remote C**: A Webpack application with React components

## Integration with Remote Entry Structure Sharing

The host application integrates with the Remote Entry Structure Sharing component in `next.config.js` using:

```javascript
// Add remote metadata consumer
config = RemoteStructureSharingIntegration.setupConsumerPlugin(config);
```

This ensures that metadata from remote applications is fetched and validated during the build process.

## Type Safety

The host application uses TypeScript definitions for all remote components, ensuring type safety when consuming federated modules. These definitions are in `remotes.d.ts`.