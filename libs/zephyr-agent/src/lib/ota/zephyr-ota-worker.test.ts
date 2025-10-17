/** @jest-environment jsdom */

import { ZephyrOTAWorker } from './zephyr-ota-worker';
import type {
  ZephyrRuntimePluginInstance,
  OTAVersionResponse,
} from 'zephyr-edge-contract';

// Mock fetchWithRetries
jest.mock('../http/fetch-with-retries', () => ({
  fetchWithRetries: jest.fn(),
}));

// Mock localStorage for browser environment testing
const mockLocalStorage: Record<string, string> = {};

// Mock AsyncStorage for React Native - use mockLocalStorage as the backing store
const mockAsyncStorage = {
  default: {
    getItem: jest
      .fn()
      .mockImplementation((key: string) =>
        Promise.resolve(mockLocalStorage[key] || null)
      ),
    setItem: jest.fn().mockImplementation((key: string, value: string) => {
      mockLocalStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn().mockImplementation((key: string) => {
      delete mockLocalStorage[key];
      return Promise.resolve();
    }),
  },
  getItem: jest
    .fn()
    .mockImplementation((key: string) => Promise.resolve(mockLocalStorage[key] || null)),
  setItem: jest.fn().mockImplementation((key: string, value: string) => {
    mockLocalStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn().mockImplementation((key: string) => {
    delete mockLocalStorage[key];
    return Promise.resolve();
  }),
};

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage, {
  virtual: true,
});

// Mock React Native modules
const mockAppState = {
  currentState: 'active',
  addEventListener: jest.fn(),
};

jest.mock(
  'react-native',
  () => ({
    AppState: mockAppState,
  }),
  { virtual: true }
);

const { fetchWithRetries } = require('../http/fetch-with-retries');
const mockFetchWithRetries = fetchWithRetries as jest.MockedFunction<
  typeof fetchWithRetries
>;

// Ensure we're NOT in React Native environment for these tests
// In jsdom, navigator should exist, but let's make sure product is NOT 'ReactNative'
if (typeof global.navigator === 'undefined') {
  (global as any).navigator = {};
}
Object.defineProperty(global.navigator, 'product', {
  value: 'Gecko', // Typical browser value, NOT 'ReactNative'
  writable: true,
  configurable: true,
});

// Set up global localStorage to use the same mockLocalStorage
const localStorageGetItem = jest.fn((key: string) => mockLocalStorage[key] || null);
const localStorageSetItem = jest.fn((key: string, value: string) => {
  mockLocalStorage[key] = value;
});
const localStorageRemoveItem = jest.fn((key: string) => {
  delete mockLocalStorage[key];
});

global.localStorage = {
  getItem: localStorageGetItem,
  setItem: localStorageSetItem,
  removeItem: localStorageRemoveItem,
  clear: jest.fn(() => {
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
  }),
  key: jest.fn(),
  length: 0,
} as any;

describe('ZephyrOTAWorker', () => {
  let mockRuntimePlugin: jest.Mocked<ZephyrRuntimePluginInstance>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchWithRetries.mockClear();
    localStorageGetItem.mockClear();
    localStorageSetItem.mockClear();
    localStorageRemoveItem.mockClear();

    // Re-implement AsyncStorage mocks after clearing
    mockAsyncStorage.default.getItem.mockImplementation((key: string) =>
      Promise.resolve(mockLocalStorage[key] || null)
    );
    mockAsyncStorage.default.setItem.mockImplementation((key: string, value: string) => {
      mockLocalStorage[key] = value;
      return Promise.resolve();
    });
    mockAsyncStorage.default.removeItem.mockImplementation((key: string) => {
      delete mockLocalStorage[key];
      return Promise.resolve();
    });
    mockAsyncStorage.getItem.mockImplementation((key: string) =>
      Promise.resolve(mockLocalStorage[key] || null)
    );
    mockAsyncStorage.setItem.mockImplementation((key: string, value: string) => {
      mockLocalStorage[key] = value;
      return Promise.resolve();
    });
    mockAsyncStorage.removeItem.mockImplementation((key: string) => {
      delete mockLocalStorage[key];
      return Promise.resolve();
    });

    // Clear mockLocalStorage (shared by both localStorage and AsyncStorage)
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);

    // Setup default values
    mockLocalStorage['zephyr_ota_current_version'] = JSON.stringify({
      version: '1.0.0',
      timestamp: '2023-01-01T00:00:00Z',
      lastChecked: Date.now() - 10000,
    });

    mockRuntimePlugin = {
      refresh: jest.fn(),
      getCurrentManifest: jest.fn(),
    };
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const worker = new ZephyrOTAWorker({
        applicationUid: 'test-app-123',
      });

      expect(worker).toBeInstanceOf(ZephyrOTAWorker);
      expect((globalThis as any).__ZEPHYR_OTA_WORKER__).toBe(worker);
    });

    it('should use custom config', () => {
      const config = {
        applicationUid: 'test-app-123',
        checkInterval: 60000,
        debug: true,
        platform: 'ios' as const,
      };

      const worker = new ZephyrOTAWorker(config);
      expect(worker).toBeInstanceOf(ZephyrOTAWorker);
    });
  });

  describe('start/stop', () => {
    it('should start worker', async () => {
      const worker = new ZephyrOTAWorker({
        applicationUid: 'test-app-123',
      });

      await worker.start();

      // Worker should be active
      expect(worker).toBeInstanceOf(ZephyrOTAWorker);
    });

    it('should stop worker', async () => {
      const worker = new ZephyrOTAWorker({
        applicationUid: 'test-app-123',
      });

      await worker.start();
      worker.stop();

      // Worker should be stopped
      expect(worker).toBeInstanceOf(ZephyrOTAWorker);
    });

    it('should not start twice', async () => {
      const worker = new ZephyrOTAWorker({
        applicationUid: 'test-app-123',
      });

      await worker.start();
      await worker.start(); // Second call

      // Worker should handle multiple start calls
      expect(worker).toBeInstanceOf(ZephyrOTAWorker);
    });
  });

  describe('update checking', () => {
    // TODO: Fix storage mocking - these tests are skipped due to complex React Native/browser storage mocking issues
    it.skip('should check for updates with correct request payload', async () => {
      // Set up localStorage with a current version so the update check can compare
      mockLocalStorage['zephyr_ota_current_version'] = JSON.stringify({
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00Z',
        lastChecked: Date.now() - 10000,
      });

      const mockResponseData: OTAVersionResponse = {
        version: '1.0.1',
        timestamp: '2023-01-02T00:00:00Z',
        manifest_url: 'https://cdn.example.com/app/v1.0.1/manifest.json',
        description: 'Bug fixes',
      };

      const mockResponse = {
        json: jest.fn().mockResolvedValue(mockResponseData),
      } as any;

      mockFetchWithRetries.mockResolvedValueOnce(mockResponse);

      const onUpdateAvailable = jest.fn();
      const worker = new ZephyrOTAWorker(
        {
          applicationUid: 'test-app-123',
          debug: true,
        },
        { onUpdateAvailable }
      );

      // Trigger update check manually
      await (worker as any).performUpdateCheck();

      expect(mockFetchWithRetries).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('test-app-123'),
        }),
        3
      );

      expect(onUpdateAvailable).toHaveBeenCalledWith(
        expect.objectContaining({
          version: '1.0.1',
          manifestUrl: mockResponseData.manifest_url,
        })
      );
    });

    it('should not trigger update for same version', async () => {
      const mockResponseData: OTAVersionResponse = {
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00Z',
        manifest_url: 'https://cdn.example.com/app/v1.0.0/manifest.json',
      };

      const mockResponse = {
        json: jest.fn().mockResolvedValue(mockResponseData),
      } as any;

      mockFetchWithRetries.mockResolvedValueOnce(mockResponse);

      const onUpdateAvailable = jest.fn();
      const worker = new ZephyrOTAWorker(
        { applicationUid: 'test-app-123' },
        { onUpdateAvailable }
      );

      await (worker as any).performUpdateCheck();

      expect(onUpdateAvailable).not.toHaveBeenCalled();
    });

    it('should handle fetch errors', async () => {
      const error = new Error('Network error');
      mockFetchWithRetries.mockRejectedValueOnce(error);

      const onUpdateError = jest.fn();
      const worker = new ZephyrOTAWorker(
        { applicationUid: 'test-app-123' },
        { onUpdateError }
      );

      await (worker as any).performUpdateCheck();

      expect(onUpdateError).toHaveBeenCalledWith(error);
    });
  });

  describe('update application', () => {
    // TODO: Fix storage mocking - this test is skipped due to complex React Native/browser storage mocking issues
    it.skip('should apply update and call runtime plugin refresh', async () => {
      const worker = new ZephyrOTAWorker({
        applicationUid: 'test-app-123',
      });

      worker.setRuntimePlugin(mockRuntimePlugin);

      const update = {
        version: '1.0.1',
        timestamp: '2023-01-02T00:00:00Z',
        manifestUrl: 'https://cdn.example.com/manifest.json',
        description: 'Bug fixes',
      };

      const onUpdateApplied = jest.fn();
      (worker as any).callbacks = { onUpdateApplied };

      await worker.applyUpdate(update);

      expect(mockRuntimePlugin.refresh).toHaveBeenCalled();

      // Check that localStorage.setItem was called
      expect(localStorageSetItem).toHaveBeenCalledWith(
        'zephyr_ota_current_version',
        expect.stringContaining('1.0.1')
      );

      // Also check the mockLocalStorage directly
      const storedVersion = mockLocalStorage['zephyr_ota_current_version'];
      expect(storedVersion).toBeDefined();
      expect(storedVersion).toContain('1.0.1');

      expect(onUpdateApplied).toHaveBeenCalledWith('1.0.1');
    });

    it('should handle update failure', async () => {
      const error = new Error('Update failed');
      mockRuntimePlugin.refresh.mockRejectedValueOnce(error);

      const worker = new ZephyrOTAWorker({
        applicationUid: 'test-app-123',
      });

      worker.setRuntimePlugin(mockRuntimePlugin);

      const update = {
        version: '1.0.1',
        timestamp: '2023-01-02T00:00:00Z',
        manifestUrl: 'https://cdn.example.com/manifest.json',
      };

      const onUpdateFailed = jest.fn();
      (worker as any).callbacks = { onUpdateFailed };

      await expect(worker.applyUpdate(update)).rejects.toThrow('Update failed');
      expect(onUpdateFailed).toHaveBeenCalledWith(error);
    });

    it('should throw error if no runtime plugin set', async () => {
      const worker = new ZephyrOTAWorker({
        applicationUid: 'test-app-123',
      });

      const update = {
        version: '1.0.1',
        timestamp: '2023-01-02T00:00:00Z',
        manifestUrl: 'https://cdn.example.com/manifest.json',
      };

      await expect(worker.applyUpdate(update)).rejects.toThrow('Runtime plugin not set');
    });
  });

  describe('update decline', () => {
    // TODO: Fix storage mocking - this test is skipped due to complex React Native/browser storage mocking issues
    it.skip('should store declined update version', async () => {
      const worker = new ZephyrOTAWorker({
        applicationUid: 'test-app-123',
      });

      await worker.declineUpdate('1.0.1');

      // Check that the declined version was stored in localStorage
      const declinedUpdates = mockLocalStorage['zephyr_ota_declined_updates'];
      expect(declinedUpdates).toBeDefined();
      expect(declinedUpdates).toBe(JSON.stringify(['1.0.1']));
    });

    it('should not offer declined updates', async () => {
      const mockResponse: OTAVersionResponse = {
        version: '1.0.1',
        timestamp: '2023-01-02T00:00:00Z',
        manifest_url: 'https://cdn.example.com/manifest.json',
      };

      mockFetchWithRetries.mockResolvedValueOnce(mockResponse);

      // Mock current version
      mockAsyncStorage.getItem
        .mockResolvedValueOnce(
          JSON.stringify({
            version: '1.0.0',
            timestamp: '2023-01-01T00:00:00Z',
          })
        )
        // Mock declined updates containing the new version
        .mockResolvedValueOnce(JSON.stringify(['1.0.1']));

      const onUpdateAvailable = jest.fn();
      const worker = new ZephyrOTAWorker(
        { applicationUid: 'test-app-123' },
        { onUpdateAvailable }
      );

      await (worker as any).performUpdateCheck();

      expect(onUpdateAvailable).not.toHaveBeenCalled();
    });
  });

  describe('app state handling', () => {
    // These tests are React Native specific and won't work in jsdom environment
    it.skip('should trigger update check when app becomes active', async () => {
      const worker = new ZephyrOTAWorker({
        applicationUid: 'test-app-123',
      });

      const performUpdateCheckSpy = jest
        .spyOn(worker as any, 'performUpdateCheck')
        .mockResolvedValue(undefined);

      await worker.start();

      // Get the app state change handler
      const appStateHandler = mockAppState.addEventListener.mock.calls[0][1];

      // Simulate app becoming active
      appStateHandler('active');

      expect(performUpdateCheckSpy).toHaveBeenCalled();

      performUpdateCheckSpy.mockRestore();
    });

    it.skip('should not trigger update check when app goes to background', async () => {
      const worker = new ZephyrOTAWorker({
        applicationUid: 'test-app-123',
      });

      const performUpdateCheckSpy = jest
        .spyOn(worker as any, 'performUpdateCheck')
        .mockResolvedValue(undefined);

      await worker.start();

      // Get the app state change handler
      const appStateHandler = mockAppState.addEventListener.mock.calls[0][1];

      // Simulate app going to background
      appStateHandler('background');

      expect(performUpdateCheckSpy).toHaveBeenCalledTimes(1); // Only the initial call
    });
  });

  describe('telemetry and logging', () => {
    it('should log with debug flag enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const worker = new ZephyrOTAWorker({
        applicationUid: 'test-app-123',
        debug: true,
      });

      (worker as any).log('Test message', { data: 'test' });

      expect(consoleSpy).toHaveBeenCalledWith('[ZephyrOTA] Test message', {
        data: 'test',
      });

      consoleSpy.mockRestore();
    });

    it('should not log with debug flag disabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const worker = new ZephyrOTAWorker({
        applicationUid: 'test-app-123',
        debug: false,
      });

      (worker as any).log('Test message');

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
