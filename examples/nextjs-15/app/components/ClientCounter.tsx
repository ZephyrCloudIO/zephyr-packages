'use client';

import { useState } from 'react';

export default function ClientCounter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h2>Client Counter</h2>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button onClick={() => setCount(count - 1)}>Decrement</button>
    </div>
  );
}