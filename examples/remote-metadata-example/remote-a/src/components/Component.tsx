import { useState } from 'react';
import styles from './Component.module.css';

/**
 * Server-Side Rendered Component from Remote A
 * 
 * This component demonstrates a Next.js SSR component that can be federated
 * and consumed by other applications while maintaining its SSR capabilities.
 */
const Component = () => {
  const [count, setCount] = useState(0);
  
  return (
    <div className={styles.ssrComponent}>
      <h4>SSR Component from Remote A</h4>
      <p>This component is rendered server-side and hydrated on the client.</p>
      <div className={styles.counter}>
        <button 
          onClick={() => setCount(count - 1)}
          className={styles.counterButton}
          aria-label="Decrement"
        >
          -
        </button>
        <span className={styles.counterValue}>{count}</span>
        <button 
          onClick={() => setCount(count + 1)}
          className={styles.counterButton}
          aria-label="Increment"
        >
          +
        </button>
      </div>
      <div className={styles.info}>
        <p><strong>Rendering:</strong> Server-Side (SSR)</p>
        <p><strong>Framework:</strong> Next.js</p>
        <p><strong>Remote:</strong> A</p>
      </div>
    </div>
  );
};

export default Component;