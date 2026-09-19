import { afterEach, describe, expect, it } from '@rstest/core';
// @ts-expect-error - the runtime plugin is untyped ESM shipped as-is to the browser.
import { resolveManifestUrl } from '../runtime_plugin.mjs';

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'document');
});

/** Minimal document stub exposing only what the resolver reads. */
function stubDocument(baseHref?: string): void {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      baseURI: baseHref ?? 'https://app.example.test/',
      querySelector: (selector: string) =>
        selector === 'base[href]' && baseHref ? { href: baseHref } : null,
    },
  });
}

describe('resolveManifestUrl', () => {
  it('resolves against the origin root when the app is deployed at the root', () => {
    expect(resolveManifestUrl('https://app.example.test/assets/index.js')).toBe(
      'https://app.example.test/zephyr-manifest.json'
    );
  });

  it('uses an explicit <base href> when the artifact is re-served under a subpath', () => {
    stubDocument('https://app.example.test/activate/');

    expect(resolveManifestUrl('https://app.example.test/activate/assets/index.js')).toBe(
      'https://app.example.test/activate/zephyr-manifest.json'
    );
  });

  it('keeps the module origin when assets are served from a separate CDN', () => {
    stubDocument('https://app.example.test/');

    expect(resolveManifestUrl('https://cdn.example.test/assets/index.js')).toBe(
      'https://cdn.example.test/zephyr-manifest.json'
    );
  });

  it('falls back to the base href when no module URL is available', () => {
    stubDocument('https://app.example.test/activate/');

    expect(resolveManifestUrl(undefined)).toBe(
      'https://app.example.test/activate/zephyr-manifest.json'
    );
  });

  it('does not trust document.baseURI without a <base href> element', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        baseURI: 'https://app.example.test/products/42',
        querySelector: () => null,
      },
    });

    expect(resolveManifestUrl('https://app.example.test/assets/index.js')).toBe(
      'https://app.example.test/zephyr-manifest.json'
    );
  });

  it('is document-relative when nothing is inspectable', () => {
    expect(resolveManifestUrl(undefined)).toBe('./zephyr-manifest.json');
  });

  it('rejects module URLs with no usable origin', () => {
    expect(resolveManifestUrl('file:///tmp/index.js')).toBe('./zephyr-manifest.json');
    expect(resolveManifestUrl('not a url')).toBe('./zephyr-manifest.json');
  });
});
