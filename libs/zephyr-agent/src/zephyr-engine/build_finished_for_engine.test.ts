import {
  build_finished_for_engine,
  type BuildFinishedContext,
} from './build_finished_for_engine';

// Mock dependencies
jest.mock('../lib/logging/picocolor', () => ({
  cyanBright: jest.fn((text) => `cyan(${text})`),
  yellow: jest.fn((text) => `yellow(${text})`),
}));

describe('build_finished_for_engine', () => {
  const mockLogger = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log deployment info when build was successful', async () => {
    const context: BuildFinishedContext = {
      logger: Promise.resolve(mockLogger),
      build_start_time: Date.now() - 5000, // 5 seconds ago
      version_url: 'https://example.com/app',
      federated_dependencies: [
        { name: '@org/app1', version: '1.0.0', default_url: 'https://example.com/app1' },
        { name: '@org/app2', version: '2.0.0', default_url: 'https://example.com/app2' },
      ],
      env: { target: 'web' },
    };

    await build_finished_for_engine(context);

    expect(mockLogger).toHaveBeenCalledTimes(2);

    // Check dependencies log
    expect(mockLogger).toHaveBeenCalledWith({
      level: 'info',
      action: 'build:info:user',
      ignore: true,
      message: 'Resolved zephyr dependencies: @org/app1, @org/app2',
    });

    // Check deployment log
    expect(mockLogger).toHaveBeenCalledWith({
      level: 'trace',
      action: 'deploy:url',
      message: expect.stringContaining("Deployed to cyan(Zephyr)'s edge in yellow("),
    });
  });

  it('should log React Native specific message for iOS target', async () => {
    const context: BuildFinishedContext = {
      logger: Promise.resolve(mockLogger),
      build_start_time: Date.now() - 3000,
      version_url: 'https://example.com/app',
      federated_dependencies: [
        { name: '@org/app1', version: '1.0.0', default_url: 'https://example.com/app1' },
      ],
      env: { target: 'ios' },
    };

    await build_finished_for_engine(context);

    expect(mockLogger).toHaveBeenCalledWith({
      level: 'info',
      action: 'build:info:user',
      ignore: true,
      message: 'Resolved zephyr dependencies: @org/app1 for platform: ios',
    });
  });

  it('should log React Native specific message for Android target', async () => {
    const context: BuildFinishedContext = {
      logger: Promise.resolve(mockLogger),
      build_start_time: Date.now() - 3000,
      version_url: 'https://example.com/app',
      federated_dependencies: [
        { name: '@org/app1', version: '1.0.0', default_url: 'https://example.com/app1' },
      ],
      env: { target: 'android' },
    };

    await build_finished_for_engine(context);

    expect(mockLogger).toHaveBeenCalledWith({
      level: 'info',
      action: 'build:info:user',
      ignore: true,
      message: 'Resolved zephyr dependencies: @org/app1 for platform: android',
    });
  });

  it('should not log anything when build start time is null', async () => {
    const context: BuildFinishedContext = {
      logger: Promise.resolve(mockLogger),
      build_start_time: null,
      version_url: 'https://example.com/app',
      federated_dependencies: [],
      env: { target: 'web' },
    };

    await build_finished_for_engine(context);

    expect(mockLogger).not.toHaveBeenCalled();
  });

  it('should not log anything when version URL is null', async () => {
    const context: BuildFinishedContext = {
      logger: Promise.resolve(mockLogger),
      build_start_time: Date.now() - 3000,
      version_url: null,
      federated_dependencies: [],
      env: { target: 'web' },
    };

    await build_finished_for_engine(context);

    expect(mockLogger).not.toHaveBeenCalled();
  });

  it('should not log dependencies when there are none', async () => {
    const context: BuildFinishedContext = {
      logger: Promise.resolve(mockLogger),
      build_start_time: Date.now() - 3000,
      version_url: 'https://example.com/app',
      federated_dependencies: null,
      env: { target: 'web' },
    };

    await build_finished_for_engine(context);

    expect(mockLogger).toHaveBeenCalledTimes(1);
    expect(mockLogger).toHaveBeenCalledWith({
      level: 'trace',
      action: 'deploy:url',
      message: expect.stringContaining("Deployed to cyan(Zephyr)'s edge"),
    });
  });

  it('should not log dependencies when array is empty', async () => {
    const context: BuildFinishedContext = {
      logger: Promise.resolve(mockLogger),
      build_start_time: Date.now() - 3000,
      version_url: 'https://example.com/app',
      federated_dependencies: [],
      env: { target: 'web' },
    };

    await build_finished_for_engine(context);

    expect(mockLogger).toHaveBeenCalledTimes(1);
    expect(mockLogger).toHaveBeenCalledWith({
      level: 'trace',
      action: 'deploy:url',
      message: expect.stringContaining("Deployed to cyan(Zephyr)'s edge"),
    });
  });
});
