/**
 * Tests for the Zephyr Next.js Adapter
 */

import zephyrNextJSAdapter from './zephyr-nextjs-adapter'
import type { NextConfigComplete, BuildContext, RouteType } from './types'

// Mock the utils and core modules
jest.mock('./utils', () => ({
  getZephyrConfig: jest.fn(() => ({
    orgId: 'test-org',
    projectId: 'test-project',
    apiKey: 'test-key',
    environment: 'test',
    buildId: 'test-build-123',
    enableModuleFederation: true,
    enableEdgeWorkers: true
  })),
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}))

jest.mock('./core', () => ({
  convertToZephyrAssets: jest.fn(() => Promise.resolve({
    staticAssets: new Map(),
    serverFunctions: new Map(),
    edgeFunctions: new Map(),
    prerenderedPages: new Map(),
    manifests: new Map(),
    publicAssets: new Map()
  })),
  createSnapshot: jest.fn(() => Promise.resolve({
    id: 'test-snapshot',
    timestamp: '2025-01-01T00:00:00.000Z',
    environment: 'test',
    framework: 'nextjs',
    metadata: { totalOutputs: 0, hasMiddleware: false, hasAPIRoutes: false, hasSSR: false, staticAssetsCount: 0, serverFunctionsCount: 0, edgeFunctionsCount: 0 },
    routes: { headers: [], redirects: [], rewrites: { beforeFiles: [], afterFiles: [], fallback: [] }, dynamicRoutes: [] },
    deploymentTargets: { cdn: { assets: [], publicAssets: [] }, edge: { functions: [] }, server: { functions: [] }, manifests: [] }
  })),
  uploadSnapshot: jest.fn(() => Promise.resolve({
    success: true,
    buildId: 'test-build-123',
    timestamp: '2025-01-01T00:00:00.000Z',
    uploadedAssets: 0
  }))
}))

describe('ZephyrNextJSAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('adapter properties', () => {
    it('should have correct name', () => {
      expect(zephyrNextJSAdapter.name).toBe('zephyr-nextjs-adapter')
    })

    it('should have modifyConfig function', () => {
      expect(typeof zephyrNextJSAdapter.modifyConfig).toBe('function')
    })

    it('should have onBuildComplete function', () => {
      expect(typeof zephyrNextJSAdapter.onBuildComplete).toBe('function')
    })
  })

  describe('modifyConfig', () => {
    it('should configure Next.js for Zephyr deployment', () => {
      const mockConfig: NextConfigComplete = {
        experimental: {}
      }

      const result = zephyrNextJSAdapter.modifyConfig(mockConfig)

      expect(result.output).toBe('standalone')
      expect(result.experimental.esmExternals).toBe(true)
      expect(result.experimental.serverComponentsExternalPackages).toContain('zephyr-agent')
      expect(result.experimental.serverComponentsExternalPackages).toContain('zephyr-edge-contract')
      expect(result.experimental.serverComponentsExternalPackages).toContain('zephyr-xpack-internal')
    })

    it('should preserve existing experimental config', () => {
      const mockConfig: NextConfigComplete = {
        experimental: {
          existingFeature: true,
          serverComponentsExternalPackages: ['existing-package']
        }
      }

      const result = zephyrNextJSAdapter.modifyConfig(mockConfig)

      expect(result.experimental.existingFeature).toBe(true)
      expect(result.experimental.serverComponentsExternalPackages).toContain('existing-package')
      expect(result.experimental.serverComponentsExternalPackages).toContain('zephyr-agent')
    })

    it('should handle webpack configuration', () => {
      const mockWebpackConfig = {
        plugins: [
          { constructor: { name: 'SomePlugin' } },
          { constructor: { name: 'ZephyrWebpackPlugin' } },
          { constructor: { name: 'AnotherPlugin' } }
        ]
      }

      const mockConfig: NextConfigComplete = {
        experimental: {},
        webpack: jest.fn().mockReturnValue(mockWebpackConfig)
      }

      const result = zephyrNextJSAdapter.modifyConfig(mockConfig)

      // Call the wrapped webpack function
      const wrappedWebpack = result.webpack!
      const processedConfig = wrappedWebpack(mockWebpackConfig, {})

      expect(processedConfig.plugins).toHaveLength(2)
      expect(processedConfig.plugins.some((p: any) => p.constructor.name.includes('Zephyr'))).toBe(false)
    })
  })

  describe('onBuildComplete', () => {
    const mockBuildContext: BuildContext = {
      routes: {
        headers: [],
        redirects: [],
        rewrites: { beforeFiles: [], afterFiles: [], fallback: [] },
        dynamicRoutes: []
      },
      outputs: [
        {
          id: 'test-output',
          pathname: '/test',
          filePath: '/path/to/test',
          type: 'APP_PAGE' as RouteType,
          runtime: 'nodejs',
          assets: {}
        }
      ]
    }

    it('should process build context successfully', async () => {
      await expect(zephyrNextJSAdapter.onBuildComplete(mockBuildContext)).resolves.not.toThrow()
    })

    it('should call core functions in correct order', async () => {
      const { convertToZephyrAssets, createSnapshot, uploadSnapshot } = require('./core')

      await zephyrNextJSAdapter.onBuildComplete(mockBuildContext)

      expect(convertToZephyrAssets).toHaveBeenCalledWith(mockBuildContext, expect.any(Object))
      expect(createSnapshot).toHaveBeenCalled()
      expect(uploadSnapshot).toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      const { convertToZephyrAssets } = require('./core')
      convertToZephyrAssets.mockRejectedValueOnce(new Error('Test error'))

      await expect(zephyrNextJSAdapter.onBuildComplete(mockBuildContext)).rejects.toThrow('Test error')
    })
  })

  describe('integration', () => {
    it('should work with empty build context', async () => {
      const emptyContext: BuildContext = {
        routes: {
          headers: [],
          redirects: [],
          rewrites: { beforeFiles: [], afterFiles: [], fallback: [] }
        },
        outputs: []
      }

      await expect(zephyrNextJSAdapter.onBuildComplete(emptyContext)).resolves.not.toThrow()
    })

    it('should work with complex build context', async () => {
      const complexContext: BuildContext = {
        routes: {
          headers: [{ source: '/api/*', headers: { 'x-api-version': '1.0' } }],
          redirects: [{ source: '/old', destination: '/new', permanent: true }],
          rewrites: {
            beforeFiles: [{ source: '/proxy/:path*', destination: 'https://api.example.com/:path*' }],
            afterFiles: [],
            fallback: []
          },
          dynamicRoutes: [{ page: '/posts/[slug]', regex: '^/posts/([^/]+?)(?:/)?$' }]
        },
        outputs: [
          {
            id: 'home-page',
            pathname: '/',
            filePath: '/app/page.js',
            type: 'APP_PAGE' as RouteType,
            runtime: 'nodejs',
            config: { revalidate: 3600 },
            assets: { 'server/app/page.js': '/app/page.js' }
          },
          {
            id: 'api-route',
            pathname: '/api/users',
            filePath: '/app/api/users/route.js',
            type: 'APP_ROUTE' as RouteType,
            runtime: 'edge',
            config: { maxDuration: 30 },
            assets: {}
          },
          {
            id: 'static-css',
            pathname: '/_next/static/css/app.css',
            filePath: '/.next/static/css/app.css',
            type: 'STATIC_FILE' as RouteType,
            assets: {}
          }
        ]
      }

      await expect(zephyrNextJSAdapter.onBuildComplete(complexContext)).resolves.not.toThrow()
    })
  })
})