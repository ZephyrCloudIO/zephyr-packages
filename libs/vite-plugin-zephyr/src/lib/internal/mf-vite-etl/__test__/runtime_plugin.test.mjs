import { afterEach, describe, expect, test } from '@rstest/core';
import { getScriptBaseUrl, inferZephyrManifestUrl } from '../runtime_plugin.mjs';

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

afterEach(() => {
  if (originalDocument) {
    Object.defineProperty(globalThis, 'document', originalDocument);
  } else {
    Reflect.deleteProperty(globalThis, 'document');
  }
});

describe('Vite runtime manifest URL inference', () => {
  test('does not mistake a nested mounted-CDN chunk directory for the deployment root', () => {
    expect(
      inferZephyrManifestUrl(
        'https://cdnedge.agoda.net/t-stable-supply-layout/assets/zephyr-runtime.mjs'
      )
    ).toBe('/zephyr-manifest.json');
  });

  test('anchors a nested ESM chunk to its reserved path-addressed deployment root', () => {
    expect(
      inferZephyrManifestUrl(
        'https://edge.example.test/__zephyr/v1/e/org.project.app/assets/runtime.mjs'
      )
    ).toBe('https://edge.example.test/__zephyr/v1/e/org.project.app/zephyr-manifest.json');
  });

  test('keeps the same-origin fallback for non-reserved hostname ESM entries', () => {
    expect(inferZephyrManifestUrl('https://app-ze.worker.example/remoteEntry.mjs')).toBe(
      '/zephyr-manifest.json'
    );
  });

  test('retains classic currentScript precedence and hostname behavior', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        currentScript: {
          src: 'https://classic.example.test/static/js/remoteEntry.js',
        },
      },
    });

    expect(getScriptBaseUrl('https://esm.example.test/mount/runtime.mjs')).toBe(
      'https://classic.example.test'
    );
  });

  test('falls back to the page origin path when no browser URL is canonical', () => {
    expect(inferZephyrManifestUrl('file:///tmp/runtime_plugin.mjs')).toBe('/zephyr-manifest.json');
  });
});
