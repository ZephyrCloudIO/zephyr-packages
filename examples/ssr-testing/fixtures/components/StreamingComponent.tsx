import React, { Suspense } from 'react';

// Simulate an async data load with controlled timing
function createResource<T>(promise: Promise<T>) {
  let status = 'pending';
  let result: T;
  let error: Error;
  
  const suspender = promise.then(
    (data) => {
      status = 'success';
      result = data;
    },
    (e) => {
      status = 'error';
      error = e;
    }
  );
  
  return {
    read() {
      if (status === 'pending') {
        throw suspender;
      } else if (status === 'error') {
        throw error;
      } else {
        return result;
      }
    }
  };
}

// Create resources with different load times
const fastResource = createResource<string>(
  new Promise((resolve) => setTimeout(() => resolve('Fast Content'), 50))
);

const mediumResource = createResource<string>(
  new Promise((resolve) => setTimeout(() => resolve('Medium Content'), 150))
);

const slowResource = createResource<string>(
  new Promise((resolve) => setTimeout(() => resolve('Slow Content'), 300))
);

// Components that read from resources
function FastComponent() {
  const data = fastResource.read();
  return <div className="fast-content">{data}</div>;
}

function MediumComponent() {
  const data = mediumResource.read();
  return <div className="medium-content">{data}</div>;
}

function SlowComponent() {
  const data = slowResource.read();
  return <div className="slow-content">{data}</div>;
}

// Loading fallbacks
const FastFallback = () => <div className="fast-fallback">Loading fast content...</div>;
const MediumFallback = () => <div className="medium-fallback">Loading medium content...</div>;
const SlowFallback = () => <div className="slow-fallback">Loading slow content...</div>;

interface StreamingComponentProps {
  /**
   * Optional className
   */
  className?: string;
}

/**
 * A component with streaming content for testing SSR streaming capabilities
 */
export function StreamingComponent({ className = '' }: StreamingComponentProps) {
  return (
    <div 
      className={`streaming-component ${className}`}
      data-testid="streaming-component"
    >
      <h1>Streaming Demo</h1>
      
      <div className="critical-content">
        <h2>Critical Content (Immediate)</h2>
        <p>This content renders immediately without Suspense</p>
      </div>
      
      {/* Fast content - loads quickly */}
      <Suspense fallback={<FastFallback />}>
        <div className="section">
          <h2>Fast Content (~50ms)</h2>
          <FastComponent />
        </div>
      </Suspense>
      
      {/* Medium content - moderate load time */}
      <Suspense fallback={<MediumFallback />}>
        <div className="section">
          <h2>Medium Content (~150ms)</h2>
          <MediumComponent />
        </div>
      </Suspense>
      
      {/* Slow content - longer load time */}
      <Suspense fallback={<SlowFallback />}>
        <div className="section">
          <h2>Slow Content (~300ms)</h2>
          <SlowComponent />
        </div>
      </Suspense>
    </div>
  );
}

export default StreamingComponent;