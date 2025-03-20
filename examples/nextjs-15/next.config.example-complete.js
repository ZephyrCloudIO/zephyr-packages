const withRspack = require('@next/plugin-rspack');
const { withZephyr } = require('zephyr-rspack-plugin');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use static export for Zephyr compatibility
  output: 'export',

  // Configure build output directory
  distDir: 'out',
};

// Apply Zephyr as the outermost wrapper
module.exports = withZephyr({
  // Optional Zephyr-specific settings
  // wait_for_index_html: true,
})(withRspack(nextConfig));
