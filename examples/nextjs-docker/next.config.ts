import type { NextConfig } from 'next';
import { withZephyr } from 'zephyr-nextjs-plugin';

const nextConfig: NextConfig = {};

// Uploads /_next/static to Zephyr after `next build` and writes .next/zephyr/: the
// deployment record, public/, and the server that streams assets back from Zephyr.
export default withZephyr(nextConfig);
