const withRspack = require('next-rspack');
const zephyr = require('zephyr-rspack-plugin');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    const newConfig = zephyr.withZephyr()(config);
    return newConfig;
  },
};

module.exports = async () => withRspack(nextConfig);
