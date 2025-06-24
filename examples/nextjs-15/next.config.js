const { withZephyr } = require('zephyr-nextjs-plugin');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, context) => {
    return withZephyr()(config, context);
  },
  output: 'standalone',
};

module.exports = nextConfig;
