// const { withZephyr } = require('zephyr-nextjs-plugin');

// /** @type {import('next').Nextonfig} */
// const nextConfig = {
//   webpack: (config, context) => {
//     // console.log('Webpack configuration:', context);
//     return withZephyr()(config, context);
//   },

// };

// module.exports = function (args, arg1, ...rest) {
// console.log('Arguments received:', args, arg1, rest);

//   return nextConfig
// };
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    adapterPath: require.resolve('./zephyr-adapter-wrapper.mjs'),
  },
};

module.exports = nextConfig;
