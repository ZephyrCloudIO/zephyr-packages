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

// Mock AsyncStorage for React Native
const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock React Native modules
const mockAppState = {
  currentState: 'active',
  addEventListener: jest.fn(),
};

jest.mock('react-native', () => ({
  AppState: mockAppState,
}));

const { fetchWithRetries } = require('../http/fetch-with-retries');
const mockFetchWithRetries = fetchWithRetries as jest.MockedFunction<
  typeof fetchWithRetries
>;

// Mock navigator for RN detection
Object.defineProperty(navigator, 'product', {
  value: 'ReactNative',
  configurable: true,
});

describe('ZephyrOTAWorker', () => {
  let mockRuntimePlugin: jest.Mocked<ZephyrRuntimePluginInstance>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockClear();
    mockAsyncStorage.setItem.mockClear();
    mockAsyncStorage.removeItem.mockClear();
    mockFetchWithRetries.mockClear();

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
    it('should start and register app state listener', async () => {
      const worker = new ZephyrOTAWorker({
        applicationUid: 'test-app-123',
      });

      await worker.start();

      expect(mockAppState.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
    });

    it('should stop and cleanup listeners', async () => {
      const mockRemove = jest.fn();
      mockAppState.addEventListener.mockReturnValue({ remove: mockRemove });

      const worker = new ZephyrOTAWorker({
        applicationUid: 'test-app-123',
      });

      await worker.start();
      worker.stop();

      expect(mockRemove).toHaveBeenCalled();
    });

    it('should not start twice', async () => {
      const worker = new ZephyrOTAWorker({
        applicationUid: 'test-app-123',
      });

      await worker.start();
      await worker.start(); // Second call

      // Should only register listener once
      expect(mockAppState.addEventListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('update checking', () => {
    it('should check for updates with correct request payload', async () => {
      const mockResponse: OTAVersionResponse = {
        version: '1.0.1',
        timestamp: '2023-01-02T00:00:00Z',
        manifest_url: 'https://cdn.example.com/app/v1.0.1/manifest.json',
        description: 'Bug fixes',
      };

      mockFetchWithRetries.mockResolvedValueOnce(mockResponse);
      mockAsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify({
          version: '1.0.0',
          timestamp: '2023-01-01T00:00:00Z',
          lastChecked: Date.now() - 10000,
        })
      );

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

      expect(mockFetchWithRetries).toHaveBeenCalledWith({
        url: expect.stringContaining('test-app-123'),
        options: expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('test-app-123'),
        }),
        retries: 3,
      });

      expect(onUpdateAvailable).toHaveBeenCalledWith(
        expect.objectContaining({
          version: '1.0.1',
          manifestUrl: mockResponse.manifest_url,
        })
      );
    });

    it('should not trigger update for same version', async () => {
      const mockResponse: OTAVersionResponse = {
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00Z',
        manifest_url: 'https://cdn.example.com/app/v1.0.0/manifest.json',
      };

      mockFetchWithRetries.mockResolvedValueOnce(mockResponse);
      mockAsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify({
          version: '1.0.0',
          timestamp: '2023-01-01T00:00:00Z',
          lastChecked: Date.now() - 10000,
        })
      );

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
    it('should apply update and call runtime plugin refresh', async () => {
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
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'zephyr_ota_current_version',
        expect.stringContaining('1.0.1')
      );
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
    it('should store declined update version', async () => {
      const worker = new ZephyrOTAWorker({
        applicationUid: 'test-app-123',
      });

      mockAsyncStorage.getItem.mockResolvedValueOnce(null); // No previous declined updates

      await worker.declineUpdate('1.0.1');

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'zephyr_ota_declined_updates',
        JSON.stringify(['1.0.1'])
      );
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
    it('should trigger update check when app becomes active', async () => {
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

    it('should not trigger update check when app goes to background', async () => {
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
