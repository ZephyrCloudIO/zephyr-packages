'use client';

import React, { lazy, Suspense, useEffect, useState } from 'react';
import { init, loadRemote } from '@module-federation/runtime';
import Skeletons from './skeletons';

let initialized = false;

function ensureInit() {
  if (initialized) return;
  init({
    name: 'vinext_host',
    remotes: [
      {
        name: 'stories_remote',
        entry: 'http://localhost:5174/remoteEntry.js',
        type: 'module',
      },
    ],
  });
  initialized = true;
}

const FederatedStories = lazy(() => {
  ensureInit();
  return loadRemote('stories_remote/Stories') as Promise<{
    default: React.ComponentType<{ storyIds: number[]; page: number }>;
  }>;
});

export default function RemoteStories({
  storyIds,
  page,
}: {
  storyIds: number[];
  page: number;
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div style={{ padding: 20, color: '#666' }}>
        <p>Could not load remote Stories component.</p>
        <p style={{ fontSize: 12 }}>
          Make sure the remote app is running on{' '}
          <code>http://localhost:5174</code>
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary onError={() => setHasError(true)}>
      <Suspense fallback={<Skeletons />}>
        <FederatedStories storyIds={storyIds} page={page} />
      </Suspense>
    </ErrorBoundary>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}
