# SSR Patterns and Best Practices with Module Federation

This document outlines the best practices, patterns, and optimization strategies for Server-Side Rendering (SSR) with Module Federation in the Zephyr ecosystem.

## Core SSR Patterns

### 1. Basic SSR with Module Federation

The foundational pattern for integrating Module Federation with Server-Side Rendering.

**Key Components:**
- Server-side remote resolution
- Shared state serialization
- Hydration coordination

**Implementation:**
```jsx
// Host Application (server)
import { loadRemoteModule } from '@mf/remote-loader';

const RemoteComponent = await loadRemoteModule({
  remote: 'remote-app',
  scope: 'remote',
  module: './Component'
});

const serverHTML = ReactDOMServer.renderToString(
  <RemoteComponent initialData={serverData} />
);

// Send HTML to client with hydration data
res.send(`
  <html>
    <body>
      <div id="root">${serverHTML}</div>
      <script>
        window.__INITIAL_DATA__ = ${JSON.stringify(serverData)}
      </script>
      <script src="/runtime.js"></script>
      <script src="/main.js"></script>
    </body>
  </html>
`);

// Client-side hydration
import { loadRemoteModule } from '@mf/remote-loader';

const RemoteComponent = await loadRemoteModule({
  remote: 'remote-app',
  scope: 'remote',
  module: './Component'
});

ReactDOM.hydrateRoot(
  document.getElementById('root'),
  <RemoteComponent initialData={window.__INITIAL_DATA__} />
);
```

**Best Practices:**
- Pre-resolve remote modules on the server
- Cache resolved modules for subsequent requests
- Include version information for better cache control
- Ensure remote module paths are consistent between server and client

### 2. Multi-Remote Composition

Pattern for composing multiple federated remotes on the server and hydrating them on the client.

**Key Components:**
- Parallel remote resolution
- Shared context providers
- Coordinated hydration

**Implementation:**
```jsx
// Server-side composition
import { loadRemoteModule } from '@mf/remote-loader';

// Parallel loading of remotes
const [HeaderComponent, ContentComponent, FooterComponent] = await Promise.all([
  loadRemoteModule({ remote: 'header-app', scope: 'header', module: './Header' }),
  loadRemoteModule({ remote: 'content-app', scope: 'content', module: './Content' }),
  loadRemoteModule({ remote: 'footer-app', scope: 'footer', module: './Footer' })
]);

// Create shared context for all remotes
const sharedContext = {
  theme: 'light',
  user: { id: 1, name: 'User' }
};

// Render with context
const serverHTML = ReactDOMServer.renderToString(
  <SharedContextProvider value={sharedContext}>
    <HeaderComponent />
    <ContentComponent />
    <FooterComponent />
  </SharedContextProvider>
);
```

**Best Practices:**
- Use shared context for cross-remote communication
- Implement fallbacks for failed remote resolution
- Define clear contracts between remotes
- Consider using TypeScript for type safety between remotes

### 3. Progressive Hydration

Pattern for selective hydration of critical components while deferring non-essential ones.

**Key Components:**
- Component prioritization
- Deferred hydration
- Island architecture

**Implementation:**
```jsx
// Server-side rendering with hydration markers
const serverHTML = ReactDOMServer.renderToString(
  <>
    <HydrationPriority level="critical">
      <HeaderComponent />
    </HydrationPriority>
    
    <HydrationPriority level="medium">
      <MainContentComponent />
    </HydrationPriority>
    
    <HydrationPriority level="low">
      <FooterComponent />
    </HydrationPriority>
  </>
);

// Client-side selective hydration
// First, hydrate critical components
hydrateComponents('critical', () => {
  // Then, hydrate medium priority components
  hydrateComponents('medium', () => {
    // Finally, hydrate low priority components
    hydrateComponents('low');
  });
});
```

**Best Practices:**
- Prioritize above-the-fold content
- Use `requestIdleCallback` for low-priority hydration
- Implement loading states for deferred components
- Avoid layout shifts during progressive hydration

### 4. Streaming SSR

Pattern for streaming HTML content to the client as it becomes available, improving Time To First Byte (TTFB) and user experience.

**Key Components:**
- Suspense boundaries
- Incremental rendering
- Chunked transfer encoding

**Implementation:**
```jsx
// Server-side streaming
const { pipe } = await ReactDOMServer.renderToPipeableStream(
  <App />,
  {
    onShellReady() {
      // Send the shell as soon as it's ready
      res.statusCode = 200;
      res.setHeader('Content-type', 'text/html');
      pipe(res);
    },
    bootstrapScripts: ['/main.js']
  }
);

// Client-side with Suspense boundaries
function App() {
  return (
    <Layout>
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      
      <Suspense fallback={<MainSkeleton />}>
        <MainContent />
      </Suspense>
      
      <Suspense fallback={<FooterSkeleton />}>
        <Footer />
      </Suspense>
    </Layout>
  );
}
```

**Best Practices:**
- Use React 18+ for streaming capabilities
- Implement nested Suspense boundaries for granular control
- Provide high-quality fallback UI
- Include resource hints like `<link rel="preload">` in the shell

## Advanced SSR Patterns

### 1. Partial Hydration

Pattern for hydrating only interactive parts of the application, keeping the majority as static HTML.

**Key Components:**
- Component-level hydration markers
- Static content preservation
- Event delegation

**Implementation:**
```jsx
// Server-side rendering with hydration markers
const serverHTML = ReactDOMServer.renderToString(
  <>
    <StaticContent>
      <Header />
      <Navigation />
    </StaticContent>
    
    <Hydrate id="search-form">
      <SearchForm />
    </Hydrate>
    
    <StaticContent>
      <MainContent />
    </StaticContent>
    
    <Hydrate id="newsletter-signup">
      <NewsletterSignup />
    </Hydrate>
  </>
);

// Client-side selective hydration
// Only hydrate components marked for hydration
hydrateElement('search-form');
hydrateElement('newsletter-signup');
```

**Best Practices:**
- Keep most content static if it doesn't need interactivity
- Use event delegation for simple interactions
- Centralize state management for hydrated islands
- Consider using lightweight frameworks for individual islands

### 2. Hybrid SSR/CSR

Pattern for combining SSR for initial page load with CSR for subsequent navigation.

**Key Components:**
- Initial SSR render
- Client-side routing
- State persistence

**Implementation:**
```jsx
// Server-side initial render
app.get('*', async (req, res) => {
  const routes = getRouteConfig();
  const { Component, context } = await matchRoute(req.url, routes);
  
  const serverHTML = ReactDOMServer.renderToString(
    <ServerContext value={context}>
      <Component />
    </ServerContext>
  );
  
  res.send(renderFullPage(serverHTML, context));
});

// Client-side routing after hydration
function App() {
  const [currentRoute, setCurrentRoute] = useState(window.location.pathname);
  
  useEffect(() => {
    // Set up client-side routing
    const handleNavigation = (path) => {
      history.pushState(null, '', path);
      setCurrentRoute(path);
    };
    
    // Attach event listeners to links
    document.addEventListener('click', handleLinkClick);
    
    return () => document.removeEventListener('click', handleLinkClick);
  }, []);
  
  const Component = routes[currentRoute].component;
  
  return <Component />;
}
```

**Best Practices:**
- Share route configuration between server and client
- Implement proper code splitting for routes
- Cache route data when possible
- Add proper loading states for client-side transitions

### 3. State Rehydration

Pattern for seamlessly transferring state from server to client during hydration.

**Key Components:**
- State serialization
- Global state management
- Hydration bootstrapping

**Implementation:**
```jsx
// Server-side state initialization and rendering
const store = createStore(initialState);

const serverHTML = ReactDOMServer.renderToString(
  <StateProvider store={store}>
    <App />
  </StateProvider>
);

// Serialize state for client hydration
const serializedState = JSON.stringify(store.getState());
const html = `
  <html>
    <body>
      <div id="root">${serverHTML}</div>
      <script>window.__INITIAL_STATE__ = ${escapeHtml(serializedState)}</script>
      <script src="/main.js"></script>
    </body>
  </html>
`;

// Client-side state rehydration
const preloadedState = window.__INITIAL_STATE__;
const store = createStore(preloadedState);

ReactDOM.hydrateRoot(
  document.getElementById('root'),
  <StateProvider store={store}>
    <App />
  </StateProvider>
);
```

**Best Practices:**
- Use a single source of truth for state
- Consider security implications of serialized state
- Sanitize state before serialization
- Use libraries that support SSR like Redux, Zustand, or Jotai

### 4. SSR with Micro-Frontends

Pattern for server-rendering composable micro-frontends with their own deployment lifecycles.

**Key Components:**
- Independent deployments
- Runtime integration
- Contract-based composition

**Implementation:**
```jsx
// Manifest-based remote resolution
const remotesManifest = await fetchRemotesManifest();

// Dynamic remote loading based on manifest
const loadRemoteComponent = async (remoteName, moduleName) => {
  const remoteConfig = remotesManifest[remoteName];
  if (!remoteConfig) throw new Error(`Remote ${remoteName} not found`);
  
  return loadRemoteModule({
    url: remoteConfig.url,
    scope: remoteConfig.scope,
    module: moduleName,
    version: remoteConfig.version
  });
};

// Server composition based on page configuration
const pageConfig = getPageConfig(req.path);
const components = await Promise.all(
  pageConfig.components.map(async ({remote, module}) => {
    return {
      Component: await loadRemoteComponent(remote, module),
      props: pageConfig.props[module] || {}
    };
  })
);

// Render composed page
const serverHTML = ReactDOMServer.renderToString(
  <PageLayout>
    {components.map(({Component, props}, index) => (
      <Component key={index} {...props} />
    ))}
  </PageLayout>
);
```

**Best Practices:**
- Use a central manifest for remote discovery
- Implement versioning for remote components
- Define clear contracts between micro-frontends
- Consider implementing a "composition service" architecture

## Performance Optimization Strategies

### 1. Code Splitting

**Strategy:** Split server and client bundles to optimize each environment.

**Implementation:**
```js
// webpack.config.js
module.exports = [
  // Server bundle
  {
    name: 'server',
    target: 'node',
    entry: './src/server.js',
    output: {
      path: path.resolve(__dirname, 'dist/server'),
      filename: 'server.js',
      libraryTarget: 'commonjs2'
    },
    // Server-specific optimizations
    externals: [nodeExternals()],
  },
  
  // Client bundle
  {
    name: 'client',
    target: 'web',
    entry: './src/client.js',
    output: {
      path: path.resolve(__dirname, 'dist/client'),
      filename: '[name].[contenthash].js',
      publicPath: '/static/'
    },
    // Client-specific optimizations
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all'
          }
        }
      }
    },
  }
];
```

**Benefits:**
- Optimal bundle sizes for each environment
- Better cache utilization
- Improved Time To Interactive (TTI)

### 2. Remote Caching

**Strategy:** Cache remote module resolutions to improve performance.

**Implementation:**
```js
// Simple in-memory cache for remote modules
const remoteCache = new Map();

const loadRemoteWithCache = async (remote, scope, module) => {
  const cacheKey = `${remote}/${scope}/${module}`;
  
  if (remoteCache.has(cacheKey)) {
    return remoteCache.get(cacheKey);
  }
  
  const moduleFactory = await loadRemoteModule({ remote, scope, module });
  remoteCache.set(cacheKey, moduleFactory);
  
  return moduleFactory;
};
```

**Enhanced Implementation with Version Control:**
```js
// Version-aware caching
const remoteCacheWithVersions = new Map();

const loadRemoteWithVersionCache = async (remote, scope, module, version) => {
  const cacheKey = `${remote}/${scope}/${module}@${version || 'latest'}`;
  
  if (remoteCacheWithVersions.has(cacheKey)) {
    return remoteCacheWithVersions.get(cacheKey);
  }
  
  const moduleFactory = await loadRemoteModule({ 
    remote, 
    scope, 
    module,
    version
  });
  
  remoteCacheWithVersions.set(cacheKey, moduleFactory);
  
  return moduleFactory;
};
```

**Benefits:**
- Reduced network requests
- Faster subsequent page loads
- Improved server response time

### 3. Stream Optimization

**Strategy:** Optimize streaming delivery for critical content first.

**Implementation:**
```jsx
// Component prioritization for streaming
function App() {
  return (
    <>
      {/* Critical UI - rendered immediately */}
      <Suspense fallback={<CriticalSkeleton />}>
        <CriticalSection />
      </Suspense>

      {/* Important but not critical - short delay */}
      <DelayedSuspenseBoundary delay={100} fallback={<ImportantSkeleton />}>
        <ImportantSection />
      </DelayedSuspenseBoundary>

      {/* Below-the-fold content - longer delay */}
      <DelayedSuspenseBoundary delay={500} fallback={<BelowFoldSkeleton />}>
        <BelowFoldContent />
      </DelayedSuspenseBoundary>
    </>
  );
}

// Delayed suspense boundary implementation
function DelayedSuspenseBoundary({ delay, fallback, children }) {
  const [showContent, setShowContent] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  
  return (
    <Suspense fallback={fallback}>
      {showContent ? children : null}
    </Suspense>
  );
}
```

**Benefits:**
- Faster perceived performance
- Prioritized critical content
- Better user experience during loading

### 4. Hydration Optimization

**Strategy:** Optimize hydration to minimize client-side processing.

**Implementation:**
```jsx
// Selective hydration based on visibility
function App() {
  return (
    <>
      {/* Always hydrate above-the-fold content */}
      <Hydrate>
        <Header />
        <Hero />
      </Hydrate>
      
      {/* Hydrate when visible */}
      <HydrateWhenVisible>
        <MainContent />
      </HydrateWhenVisible>
      
      {/* Hydrate on interaction */}
      <HydrateOnInteraction selector="#comments-section">
        <Comments />
      </HydrateOnInteraction>
    </>
  );
}

// Implementation of visibility-based hydration
function HydrateWhenVisible({ children }) {
  const ref = useRef(null);
  const [hydrated, setHydrated] = useState(false);
  
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback for browsers without IntersectionObserver
      setHydrated(true);
      return;
    }
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setHydrated(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // Start hydration when within 200px of viewport
    );
    
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  
  return (
    <div ref={ref}>
      {hydrated ? children : <StaticHtml html={serverRenderedHtml} />}
    </div>
  );
}
```

**Benefits:**
- Reduced JavaScript execution on page load
- Better interaction readiness for visible components
- Improved First Input Delay (FID)

## Debugging and Troubleshooting Guide

### Common SSR Issues and Solutions

#### 1. Hydration Mismatches

**Symptoms:**
- React warnings about hydration mismatches
- Content flickers during hydration
- UI differences between server and client

**Causes:**
- Different content rendered on server vs. client
- Dynamic data (time, random values) inconsistency
- Different component tree structure

**Solutions:**
```jsx
// 1. Ensure consistent rendering between server and client
function UserGreeting({ user }) {
  // Use a stable value for both server and client
  const userName = user?.name || 'Guest';
  
  return <h1>Hello, {userName}</h1>;
}

// 2. Synchronize time/date between server and client
function TimeDisplay() {
  const [serverTime] = useState(() => {
    // Use the server time as initial state
    return typeof window === 'undefined' 
      ? new Date().toISOString() 
      : window.__SERVER_TIME__;
  });
  
  const [currentTime, setCurrentTime] = useState(serverTime);
  
  // Update time on client only AFTER hydration
  useEffect(() => {
    setCurrentTime(new Date().toISOString());
  }, []);
  
  return <p>Current time: {currentTime}</p>;
}
```

#### 2. Module Federation Resolution Failures

**Symptoms:**
- Error messages about failed module loading
- Missing components in rendered output
- Hydration errors due to missing components

**Causes:**
- Remote module unavailable or incorrect URL
- Version conflicts between server and client
- Different resolution paths on server vs. client

**Solutions:**
```jsx
// 1. Implement robust error handling for remote loading
async function loadRemoteWithFallback(remote, scope, module) {
  try {
    return await loadRemoteModule({ remote, scope, module });
  } catch (error) {
    console.error(`Failed to load ${module} from ${remote}`, error);
    // Return a fallback component
    return () => <FallbackComponent remoteName={remote} moduleName={module} />;
  }
}

// 2. Ensure consistent resolution between server and client
// Shared configuration file used by both server and client
const remoteConfig = {
  'app1': {
    url: process.env.APP1_URL || 'http://localhost:3001/remoteEntry.js',
    scope: 'app1',
  },
  'app2': {
    url: process.env.APP2_URL || 'http://localhost:3002/remoteEntry.js',
    scope: 'app2',
  }
};

// Use the same config on both server and client
const loadConfiguredRemote = async (appName, module) => {
  const config = remoteConfig[appName];
  if (!config) throw new Error(`Unknown remote: ${appName}`);
  
  return loadRemoteModule({
    url: config.url,
    scope: config.scope,
    module
  });
};
```

#### 3. Performance Bottlenecks

**Symptoms:**
- Slow server response time
- High Time To First Byte (TTFB)
- Memory usage spikes on the server

**Causes:**
- Inefficient rendering of large component trees
- Too many concurrent requests
- Memory leaks in server components

**Solutions:**
```jsx
// 1. Implement render caching for expensive components
const renderCache = new Map();

async function renderWithCache(Component, props, cacheKey, ttl = 60000) {
  if (renderCache.has(cacheKey)) {
    const cached = renderCache.get(cacheKey);
    if (Date.now() - cached.timestamp < ttl) {
      return cached.html;
    }
  }
  
  const html = await ReactDOMServer.renderToString(<Component {...props} />);
  
  renderCache.set(cacheKey, {
    html,
    timestamp: Date.now()
  });
  
  return html;
}

// 2. Implement rendering concurrency limits
const renderQueue = new PQueue({ concurrency: 4 });

app.get('*', async (req, res) => {
  // Queue rendering to limit concurrent renderings
  const html = await renderQueue.add(() => renderApp(req));
  res.send(html);
});
```

## Best Practices Summary

### Architecture Best Practices

1. **Clear Separation of Concerns**
   - Separate rendering logic from data fetching
   - Define clear boundaries between remotes
   - Implement strong contracts between components

2. **Isomorphic Design**
   - Write code that works in both server and client environments
   - Use environment detection instead of branching code paths
   - Implement universal data fetching strategies

3. **Progressive Enhancement**
   - Ensure basic functionality works without JavaScript
   - Add interactivity in layers
   - Prioritize critical user interactions

### Performance Best Practices

1. **Optimize Critical Rendering Path**
   - Minimize server rendering time
   - Reduce JavaScript bundle size
   - Prioritize above-the-fold content

2. **Efficient Hydration**
   - Use selective or progressive hydration
   - Hydrate only interactive components
   - Defer non-critical hydration

3. **Caching Strategy**
   - Cache remote module resolutions
   - Implement component-level rendering cache
   - Use HTTP caching headers effectively

### Development Best Practices

1. **Testing and Validation**
   - Test server rendering separately from hydration
   - Validate component contracts across remotes
   - Implement cross-browser testing

2. **Monitoring and Metrics**
   - Track server rendering time
   - Monitor client hydration performance
   - Measure Time To Interactive (TTI)

3. **Documentation and Standards**
   - Document integration patterns
   - Establish clear component APIs
   - Create shared TypeScript interfaces

## Conclusion

Server-Side Rendering with Module Federation provides powerful capabilities for building performant, scalable applications with independently deployable parts. By adopting these patterns and best practices, you can ensure a robust implementation that delivers excellent user experience and developer productivity.

The patterns outlined in this document have been validated through the Zephyr SSR examples and testing infrastructure, providing a solid foundation for implementing SSR with Module Federation in your own applications.