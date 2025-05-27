import {
  defer_create_zephyr_engine,
  type ZephyrEngineInterface,
  type ZephyrEngineOptions,
} from './defer_create_zephyr_engine';

describe('defer_create_zephyr_engine', () => {
  const mockOptions: ZephyrEngineOptions = {
    context: '/test/context',
    builder: 'webpack',
  };

  it('should create deferred engine with promise and defer create function', () => {
    const mockZephyrEngine = { test: 'engine' };
    const mockZephyrEngineClass: ZephyrEngineInterface = {
      create: jest.fn().mockResolvedValue(mockZephyrEngine),
    };

    const deferred = defer_create_zephyr_engine(mockZephyrEngineClass);

    expect(deferred).toHaveProperty('zephyr_engine_defer');
    expect(deferred).toHaveProperty('zephyr_defer_create');
    expect(deferred.zephyr_engine_defer).toBeInstanceOf(Promise);
    expect(typeof deferred.zephyr_defer_create).toBe('function');
  });

  it('should resolve promise when zephyr_defer_create is called with successful creation', async () => {
    const mockZephyrEngine = { test: 'engine' };
    const mockZephyrEngineClass: ZephyrEngineInterface = {
      create: jest.fn().mockResolvedValue(mockZephyrEngine),
    };

    const deferred = defer_create_zephyr_engine(mockZephyrEngineClass);

    // Call the defer create function
    deferred.zephyr_defer_create(mockOptions);

    // Wait for the promise to resolve
    const result = await deferred.zephyr_engine_defer;

    expect(mockZephyrEngineClass.create).toHaveBeenCalledWith(mockOptions);
    expect(result).toBe(mockZephyrEngine);
  });

  it('should reject promise when zephyr_defer_create is called with failed creation', async () => {
    const mockError = new Error('Creation failed');
    const mockZephyrEngineClass: ZephyrEngineInterface = {
      create: jest.fn().mockRejectedValue(mockError),
    };

    const deferred = defer_create_zephyr_engine(mockZephyrEngineClass);

    // Call the defer create function
    deferred.zephyr_defer_create(mockOptions);

    // Wait for the promise to reject
    await expect(deferred.zephyr_engine_defer).rejects.toBe(mockError);
    expect(mockZephyrEngineClass.create).toHaveBeenCalledWith(mockOptions);
  });

  it('should handle multiple defer create calls (each call executes create)', async () => {
    const mockZephyrEngine = { test: 'engine' };
    const mockZephyrEngineClass: ZephyrEngineInterface = {
      create: jest.fn().mockResolvedValue(mockZephyrEngine),
    };

    const deferred = defer_create_zephyr_engine(mockZephyrEngineClass);

    // Call defer create multiple times
    deferred.zephyr_defer_create(mockOptions);
    deferred.zephyr_defer_create({ ...mockOptions, builder: 'vite' });

    const result = await deferred.zephyr_engine_defer;

    // Each defer create call executes, but only first one resolves the promise
    expect(mockZephyrEngineClass.create).toHaveBeenCalledTimes(2);
    expect(mockZephyrEngineClass.create).toHaveBeenNthCalledWith(1, mockOptions);
    expect(mockZephyrEngineClass.create).toHaveBeenNthCalledWith(2, {
      ...mockOptions,
      builder: 'vite',
    });
    expect(result).toBe(mockZephyrEngine);
  });
});
