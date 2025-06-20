const path = require('path');
const { ModuleFederationPlugin } = require('@module-federation/enhanced/webpack');
const { withZephyr } = require('zephyr-webpack-plugin');

const config = {
  mode: 'production',
  target: 'async-node',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    chunkFilename: '[id].js',
    libraryTarget: 'commonjs2',
    clean: true,
    publicPath: 'auto',
  },
  optimization: {
    minimize: false, // Disable minimization for easier debugging
    moduleIds: 'named', // Use named module IDs for easier debugging
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
        type: 'commonjs-module',
        name: 'weather_tools_mcp',
      },
      runtimePlugins: [
        require.resolve('@module-federation/node/runtimePlugin'),
      ],
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
  // Metadata for Zephyr
  metadata: {
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