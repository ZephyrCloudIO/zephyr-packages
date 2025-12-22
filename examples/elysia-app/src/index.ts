import { Elysia } from 'elysia';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';

const elysia = new Elysia({ adapter: CloudflareAdapter })
  .get('/', () => ({ hello: 'Zephyr👋' }))
  .compile();

console.log(`Listening on http://localhost:3000`);

export default elysia;
