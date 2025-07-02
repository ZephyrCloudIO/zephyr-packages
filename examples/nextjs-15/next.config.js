/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    adapterPath: require.resolve('zephyr-nextjs-adapter'),
  },
};

module.exports = nextConfig;
