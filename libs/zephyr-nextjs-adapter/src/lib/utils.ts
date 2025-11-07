/** Utility functions for the Zephyr Next.js Adapter */

import type { ZephyrConfig, AdapterOutput } from './types';

/**
 * Get Zephyr configuration using the same auto-discovery approach as other plugins This
 * mirrors the pattern used in zephyr-agent for automatic git and package.json detection
 */
export async function getZephyrConfig(): Promise<ZephyrConfig> {
  try {
    // Try to import and use existing Zephyr infrastructure for auto-discovery
    const { ZephyrEngine } = await import('zephyr-agent');

    // Create a temporary ZephyrEngine instance to access the auto-discovery
    const tempEngine = await ZephyrEngine.create({
      context: process.cwd(),
      builder: 'unknown',
    });

    return {
      orgId: tempEngine.applicationProperties.org,
      projectId: tempEngine.applicationProperties.project,
      // API key still comes from environment or auth system
      apiKey: process.env['ZEPHYR_API_KEY'],
      environment: process.env['NODE_ENV'] || 'development',
      buildId: `nextjs-${tempEngine.applicationProperties.name}-${tempEngine.applicationProperties.version}-${Date.now()}`,
      enableModuleFederation: process.env['ZEPHYR_MODULE_FEDERATION'] === 'true',
      enableEdgeWorkers: process.env['ZEPHYR_EDGE_WORKERS'] !== 'false',
      // Additional auto-discovered metadata
      gitInfo: tempEngine.gitProperties.git,
      packageInfo: {
        name: tempEngine.npmProperties.name,
        version: tempEngine.npmProperties.version,
      },
    };
  } catch {
    // Fallback to environment variables if auto-discovery fails
    return {
      orgId: process.env['ZEPHYR_ORG_ID'],
      projectId: process.env['ZEPHYR_PROJECT_ID'],
      apiKey: process.env['ZEPHYR_API_KEY'],
      environment: process.env['NODE_ENV'] || 'development',
      buildId: `nextjs-build-${Date.now()}`,
      enableModuleFederation: process.env['ZEPHYR_MODULE_FEDERATION'] === 'true',
      enableEdgeWorkers: process.env['ZEPHYR_EDGE_WORKERS'] !== 'false',
    };
  }
}

// Dynamic import for zephyr-agent to avoid static imports of lazy-loaded libraries

/**
 * Create a logger using only Zephyr's debug logging system No plain console outputs -
 * only structured Zephyr logs
 */
export function createLogger() {
  // Create no-op fallback functions if zephyr-agent is not available
  const noop = () => {
    /* intentionally empty */
  };

  let ze_log: Record<string, (...args: unknown[]) => void> = {
    init: noop,
    config: noop,
    misc: noop,
    app: noop,
    upload: noop,
    snapshot: noop,
  };
  let ZephyrError: { format: (e: unknown) => unknown } = { format: (e: unknown) => e };

  // Try to load zephyr-agent synchronously if available
  try {
    const agent = require('zephyr-agent');
    ze_log = agent.ze_log;
    ZephyrError = agent.ZephyrError;
  } catch {
    // Fallback to console for development
    ze_log = {
      init: console.log,
      config: console.log,
      misc: console.log,
      app: console.log,
      upload: console.log,
      snapshot: console.log,
    };
  }

  return {
    debug: {
      init: (message: string, ...args: unknown[]) => ze_log['init'](message, ...args),
      config: (message: string, ...args: unknown[]) => ze_log['config'](message, ...args),
      misc: (message: string, ...args: unknown[]) => ze_log['misc'](message, ...args),
      app: (message: string, ...args: unknown[]) => ze_log['app'](message, ...args),
      upload: (message: string, ...args: unknown[]) => ze_log['upload'](message, ...args),
      snapshot: (message: string, ...args: unknown[]) =>
        ze_log['snapshot'](message, ...args),
    },
    error: (message: string, error?: unknown) => {
      if (error) {
        ze_log['misc'](`ERROR: ${message}`, ZephyrError.format(error));
      } else {
        ze_log['misc'](`ERROR: ${message}`);
      }
    },
  };
}

/** Determine the appropriate Zephyr deployment target for an output */
export function determineDeploymentTarget(
  output: AdapterOutput
): 'cdn' | 'edge' | 'server' {
  switch (output.type) {
    case 'STATIC_FILE':
      return 'cdn';

    case 'MIDDLEWARE':
      return 'edge';

    case 'APP_ROUTE':
    case 'PAGES_API':
      return output.runtime === 'edge' ? 'edge' : 'server';

    case 'APP_PAGE':
    case 'PAGES':
      return output.runtime === 'edge' ? 'edge' : 'server';

    default:
      return 'server';
  }
}

// Simple functional programming helpers

/** Convert array of tuples to Map */
export const toMap = <T>(items: [string, T][]): Map<string, T> => new Map(items);

// Route transformation utilities

/** Ensure array exists */
export const ensureArray = <T>(items: T[] | undefined): T[] => items || [];

/** Transform headers from Next.js format to legacy format */
export const transformHeaders = (headers: unknown): Record<string, string> => {
  if (!headers) return {};
  if (Array.isArray(headers)) {
    return headers.reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {});
  }
  return headers as Record<string, string>;
};

/** Create header route transformer */
export const createHeaderRouteTransform = (route: unknown) => {
  const r = route as Record<string, unknown>;
  return {
    source: (r['source'] as string) || '',
    headers: transformHeaders(r['headers']),
    has: r['has'],
    missing: r['missing'],
  };
};

/** Create redirect route transformer */
export const createRedirectRouteTransform = (route: unknown) => {
  const r = route as Record<string, unknown>;
  return {
    source: (r['source'] as string) || '',
    destination: (r['destination'] as string) || '',
    permanent: r['permanent'],
    statusCode: r['statusCode'],
    has: r['has'],
    missing: r['missing'],
  };
};

/** Create rewrite route transformer */
export const createRewriteRouteTransform = (route: unknown) => {
  const r = route as Record<string, unknown>;
  return {
    source: (r['source'] as string) || '',
    destination: (r['destination'] as string) || '',
    has: r['has'],
    missing: r['missing'],
  };
};

/** Create dynamic route transformer */
export const createDynamicRouteTransform = () => ({
  page: '',
  regex: '',
});

/** Transform routes using functional composition */
export const transformRoutes = (routes: unknown) => {
  const r = routes as Record<string, unknown>;
  const rewrites = r['rewrites'] as Record<string, unknown> | undefined;
  return {
    headers: ensureArray(r['headers'] as unknown[]).map(createHeaderRouteTransform),
    redirects: ensureArray(r['redirects'] as unknown[]).map(createRedirectRouteTransform),
    rewrites: {
      beforeFiles: ensureArray(rewrites?.['beforeFiles'] as unknown[]).map(
        createRewriteRouteTransform
      ),
      afterFiles: ensureArray(rewrites?.['afterFiles'] as unknown[]).map(
        createRewriteRouteTransform
      ),
      fallback: ensureArray(rewrites?.['fallback'] as unknown[]).map(
        createRewriteRouteTransform
      ),
    },
    dynamicRoutes: ensureArray(r['dynamicRoutes'] as unknown[]).map(
      createDynamicRouteTransform
    ),
  };
};

/** Check if an output is compatible with module federation */
export function isModuleFederationCompatible(output: AdapterOutput): boolean {
  // Static assets and certain types of pages can be federated
  return ['STATIC_FILE', 'APP_PAGE', 'PAGES'].includes(output.type);
}

/** Check if an output should be cached by CDN */
export function isCacheable(output: AdapterOutput): boolean {
  // Static assets are cacheable, dynamic content is not
  return output.type === 'STATIC_FILE';
}

/** Convert Map to Array for JSON serialization */
export function convertMapToArray<T>(map: Map<string, T>): T[] {
  return Array.from(map.values());
}

/** Check if output is a public asset (from public folder) */
export function isPublicAsset(output: AdapterOutput): boolean {
  return (
    output.type === 'STATIC_FILE' &&
    !output.pathname.startsWith('/_next/') &&
    !output.pathname.startsWith('/api/')
  );
}

/** Check if output is a static Next.js asset */
export function isNextJSStaticAsset(output: AdapterOutput): boolean {
  return output.type === 'STATIC_FILE' && output.pathname.startsWith('/_next/static/');
}

/** Generate a unique asset ID from output */
export function generateAssetId(output: AdapterOutput): string {
  return output.id || `${output.type}-${output.pathname.replace(/[^a-zA-Z0-9]/g, '-')}`;
}

/**
 * Validate required Zephyr configuration With auto-discovery, we only require API key as
 * everything else is auto-detected
 */
export function validateZephyrConfig(config: ZephyrConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // API key is still required for authentication
  if (!config.apiKey) {
    errors.push(
      'ZEPHYR_API_KEY is required (or use `zephyr login` for token-based auth)'
    );
  }

  // With auto-discovery, org and project should be available from git
  if (!config.orgId) {
    errors.push(
      'Organization not found - ensure you are in a git repository with remote origin'
    );
  }

  if (!config.projectId) {
    errors.push(
      'Project not found - ensure you are in a git repository with remote origin'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/** Create a delay for rate limiting or simulation */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Get file size in a human readable format */
export async function getFileSize(filePath: string): Promise<string> {
  try {
    const fs = await import('fs/promises');
    const stats = await fs.stat(filePath);
    const bytes = stats.size;

    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  } catch {
    return 'unknown';
  }
}

/** Calculate a simple hash for build identification */
export function calculateBuildHash(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16);
}

/** Filter sensitive information from logs */
export function sanitizeForLogging(obj: unknown): unknown {
  const sensitive = ['apiKey', 'token', 'password', 'secret'];

  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLogging);
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (sensitive.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
