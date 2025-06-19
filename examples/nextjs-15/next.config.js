const withRspack = require('next-rspack');
const zephyr = require('zephyr-rspack-plugin');

/** @type {import('next').NextConfig} */
const ze_nextConfig = {
  swcMinify: false,
  compiler: {
    minify: false,
  },
  experimental: {
    allowDevelopmentBuild: true,
    serverMinification: false, // Disables server-side minification
    // Other options like optimizeServerReact: false, turbo: { minify: false }
    // might also be relevant depending on specific needs.
  },
  webpack: (config) => {
    const newConfig = zephyr.withZephyr()(config);
    return newConfig;
  },
};

const nextConfig = {};

console.log('nextConfig', nextConfig);

module.exports = async () =>
  process.env.ZC ? withRspack(ze_nextConfig) : withRspack(nextConfig);
