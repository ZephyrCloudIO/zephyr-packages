const path = require('path');
const { ModuleFederationPlugin } = require('@module-federation/enhanced/webpack');
const {
  DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
} = require('@modelcontextprotocol/sdk/types.js');
const { withZephyr } = require('zephyr-mcp-plugin');

const config = {
  mode: 'production',
  target: 'async-node',
  output: {
    chunkFilename: '[id]-[contenthash].js', // important to hash chunks
    publicPath: 'auto',
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
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
          },
        },
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'weather_tools_mcp',
      filename: 'remoteEntry.js',
      exposes: {
        './weather': './src/weather-tools.ts',
      },
      library: {
        type: 'commonjs2',
      },
      runtimePlugins: [require.resolve('@module-federation/node/runtimePlugin')],
      shared: {
        '@modelcontextprotocol/sdk': {
          singleton: true,
          requiredVersion: '^1.0.0',
        },
      },
    }),
  ],
};

// Apply Zephyr plugin for automatic deployment
module.exports = withZephyr({
  // MCP metadata for Zephyr
  mcpVersion: DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
  mcpMetadata: {
    description: 'Weather tools for MCP - get weather forecasts and current conditions',
    author: 'Example Developer',
    homepage: 'https://github.com/example/weather-tools-mcp',
    documentation: 'https://github.com/example/weather-tools-mcp/wiki',
    capabilities: {
      tools: ['get_weather', 'get_forecast', 'search_location'],
    },
    category: 'utilities',
    tags: ['weather', 'api', 'forecast'],
  },
})(config);
