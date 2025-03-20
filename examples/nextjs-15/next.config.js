const withRspack = require('@next/plugin-rspack');
const { withZephyr } = require('zephyr-rspack-plugin');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Generate static output
  distDir: 'out', // Use a specific output directory
};

module.exports = withZephyr({
  wait_for_index_html: true,
})(withRspack(nextConfig));
