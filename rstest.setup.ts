import { rs } from '@rstest/core';

const jestCompat = rs as typeof rs & {
  mocked: <T>(value: T) => T;
};

const originalMock = rs.mock.bind(rs);
const originalMockRequire = rs.mockRequire.bind(rs);

const INTERNAL_FUNCTION_KEYS = new Set(['length', 'name', 'prototype']);

function cloneDescriptorWithMockedValue(
  descriptor: PropertyDescriptor,
  seen: WeakMap<object, unknown>
): PropertyDescriptor {
  if (!('value' in descriptor)) {
    return descriptor;
  }

  return {
    ...descriptor,
    value: createAutoMock(descriptor.value, seen),
  };
}

function defineSafeProperty(target: object, key: string | symbol, descriptor: PropertyDescriptor): void {
  try {
    Object.defineProperty(target, key, descriptor);
  } catch {
    if ('value' in descriptor) {
      (target as Record<string | symbol, unknown>)[key] = descriptor.value;
    }
  }
}

function createAutoMock<T>(value: T, seen: WeakMap<object, unknown> = new WeakMap()): T {
  if (typeof value === 'function') {
    const fn = value as unknown as object;
    if (seen.has(fn)) {
      return seen.get(fn) as T;
    }

    const fnMock = rs.fn() as unknown as Record<string | symbol, unknown>;
    seen.set(fn, fnMock);

    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === 'string' && INTERNAL_FUNCTION_KEYS.has(key)) {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) {
        continue;
      }

      defineSafeProperty(fnMock, key, cloneDescriptorWithMockedValue(descriptor, seen));
    }

    if (!('default' in fnMock)) {
      fnMock.default = fnMock;
    }
    if (!('__esModule' in fnMock)) {
      fnMock.__esModule = true;
    }

    return fnMock as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const source = value as unknown as object;
  if (seen.has(source)) {
    return seen.get(source) as T;
  }

  const isArray = Array.isArray(value);
  const objectMock = (isArray ? [] : {}) as Record<string | symbol, unknown>;
  seen.set(source, objectMock);

  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) {
      continue;
    }

    defineSafeProperty(objectMock, key, cloneDescriptorWithMockedValue(descriptor, seen));
  }

  if (!('__esModule' in objectMock)) {
    objectMock.__esModule = true;
  }
  if (!('default' in objectMock)) {
    objectMock.default = objectMock;
  }

  return objectMock as T;
}

function normalizeMockModule(moduleValue: unknown): unknown {
  if (!moduleValue || typeof moduleValue !== 'object') {
    if (typeof moduleValue === 'function') {
      const fn = moduleValue as unknown as { default?: unknown; __esModule?: boolean };
      if (fn.default === undefined) {
        fn.default = moduleValue;
      }
      if (fn.__esModule === undefined) {
        fn.__esModule = true;
      }
    }
    return moduleValue;
  }

  const moduleObject = moduleValue as Record<string, unknown>;
  if (!('__esModule' in moduleObject)) {
    moduleObject.__esModule = true;
  }
  if (!('default' in moduleObject)) {
    moduleObject.default = moduleObject;
  }
  return moduleObject;
}

jestCompat.mock = (moduleName: string | Promise<unknown>, moduleFactory?: unknown) => {
  if (typeof moduleName !== 'string') {
    return originalMock(moduleName as Promise<unknown>, moduleFactory as never);
  }

  if (moduleFactory) {
    const factory = moduleFactory as () => unknown;
    const syncFactory = () => normalizeMockModule(factory());
    const asyncFactory = async () => normalizeMockModule(await factory());

    originalMockRequire(moduleName, syncFactory);
    return originalMock(moduleName, asyncFactory as never);
  }

  const autoModule = createAutoMock(rs.requireActual(moduleName));
  const syncFactory = () => normalizeMockModule(autoModule);
  const asyncFactory = async () => normalizeMockModule(autoModule);

  originalMockRequire(moduleName, syncFactory);
  return originalMock(moduleName, asyncFactory as never);
};

jestCompat.mocked = <T>(value: T): T => value;

// Keep legacy Jest-style globals working while tests migrate to RStest APIs.
(globalThis as { jest?: typeof jestCompat }).jest = jestCompat;
