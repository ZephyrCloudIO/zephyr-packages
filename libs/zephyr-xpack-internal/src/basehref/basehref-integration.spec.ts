import { describe, expect, it } from '@rstest/core';
import { detectBaseHref } from './basehref-integration';

function compiler(publicPath: string, base?: string) {
  class HtmlRspackPlugin {
    options = { base };
  }
  return {
    options: { output: { publicPath }, plugins: base ? [new HtmlRspackPlugin()] : [] },
  };
}

describe('coordinated compiler application bases', () => {
  it('removes the server output prefix without changing the client base', () => {
    expect(detectBaseHref(compiler('/'), undefined)).toBe('/');
    expect(detectBaseHref(compiler('/bundles/'), undefined, 'bundles')).toBe('');
    expect(
      detectBaseHref(compiler('https://cdn.test/store/bundles/'), undefined, 'bundles')
    ).toBe('store');
    expect(
      detectBaseHref(compiler('/store/server/bundles/'), undefined, 'server/bundles')
    ).toBe('store');
  });
  it('does not remove a partial segment or an unrelated compiler base', () => {
    expect(detectBaseHref(compiler('/notbundles/'), undefined, 'bundles')).toBe(
      '/notbundles/'
    );
    expect(detectBaseHref(compiler('/other/'), undefined, 'bundles')).toBe('/other/');
  });
  it('preserves explicit application bases even when named like the output folder', () => {
    expect(detectBaseHref(compiler('/bundles/', '/bundles/'), undefined, 'bundles')).toBe(
      '/bundles/'
    );
    expect(
      detectBaseHref(compiler('/store/bundles/'), { baseHref: '/custom/' }, 'bundles')
    ).toBe('/custom/');
  });
  it('leaves single-compiler and automatic public paths unchanged', () => {
    expect(detectBaseHref(compiler('/bundles/'))).toBe('/bundles/');
    expect(detectBaseHref(compiler('auto'), undefined, 'bundles')).toBeUndefined();
  });
});
