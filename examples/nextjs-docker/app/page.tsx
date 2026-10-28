import { hostname } from 'node:os';
import { Counter } from './counter';

// Render on every request, so each response shows the container that produced it.
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <main>
      <img src="/zephyr.svg" alt="" width={48} height={48} />
      <h1>Zephyr Next.js in Docker</h1>
      <p>This page was rendered by your container. Its JavaScript and CSS came from Zephyr.</p>
      <dl>
        <dt>Rendered at</dt>
        <dd>{new Date().toISOString()}</dd>
        <dt>Container</dt>
        <dd>{hostname()}</dd>
        <dt>Zephyr deployment</dt>
        <dd>{process.env.ZEPHYR_URL ?? 'not running behind zephyr-server.mjs'}</dd>
      </dl>
      <Counter />
    </main>
  );
}
