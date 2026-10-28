'use client';

import { useState, type ComponentType } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  const [Details, setDetails] = useState<ComponentType | null>(null);

  return (
    <section>
      <button type="button" onClick={() => setCount(count + 1)}>
        Hydrated: clicked {count} times
      </button>
      <button
        type="button"
        onClick={async () => {
          // A lazy chunk, fetched from Zephyr only when needed.
          const { Details } = await import('./details');
          setDetails(() => Details);
        }}
      >
        Load a lazy chunk
      </button>
      {Details && <Details />}
    </section>
  );
}
