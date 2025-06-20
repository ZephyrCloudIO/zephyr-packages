import { defineConfig } from '@rspack/cli';
import { withZephyr } from 'zephyr-mcp-plugin';

const config = defineConfig({
  mode: 'production',
  target: 'async-node',
  entry: './src/index.ts',
  optimization: {
    minimize: false, // Disable minimization for easier debugging
    moduleIds: 'named', // Use named module IDs for easier debugging
  },
  output: {
    path: './dist',
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    clean: true,
    publicPath: 'auto',
    chunkFilename: '[id].js', // Ensure consistent chunk naming
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
              },
              target: 'es2020',
            },
          },
        },
      },
    ],
  },
});

// Apply Zephyr plugin - it will automatically add Module Federation and deploy to Zephyr
export default withZephyr({
  // Module Federation config for the MCP server
  mfConfig: {
    name: 'github_tools_mcp',
    filename: 'remoteEntry.js',
    exposes: {
      './github': './src/github-tools.ts',
    },
  },
  // Metadata for Zephyr
  metadata: {
    description: 'GitHub tools for MCP - create issues, PRs, and search',
    author: 'Example Developer',
    homepage: 'https://github.com/example/github-tools-mcp',
    documentation: 'https://github.com/example/github-tools-mcp/wiki',
    capabilities: {
      tools: ['create_issue', 'search_issues', 'create_pr'],
    },
    // Additional metadata
    category: 'development',
    tags: ['github', 'vcs', 'collaboration'],
  },
})(config);
