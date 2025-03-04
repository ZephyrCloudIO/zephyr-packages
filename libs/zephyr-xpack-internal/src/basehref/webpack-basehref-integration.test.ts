import { processWebpackBaseHref } from './webpack-basehref-integration';
import * as pathHandler from './basepath-handler';

// Mock the path handler functions
jest.mock('./basepath-handler', () => ({
  detectBasePathFromWebpack: jest.fn().mockReturnValue('/detected-base/'),
  transformAssetPathsWithBase: jest.fn().mockImplementation((assetsMap, basePath) => {
    if (!basePath) return assetsMap;
    return { ...assetsMap, transformed: true };
  })
}));

describe('processWebpackBaseHref', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns original assetsMap when disabled', () => {
    const webpackConfig = { /* mock webpack config */ };
    const assetsMap = { /* mock assets map */ };
    const options = { baseHref: { enabled: false } };

    const result = processWebpackBaseHref(webpackConfig, assetsMap, options);

    expect(result).toBe(assetsMap);
    expect(pathHandler.detectBasePathFromWebpack).not.toHaveBeenCalled();
    expect(pathHandler.transformAssetPathsWithBase).not.toHaveBeenCalled();
  });

  test('transforms assets when base path detected', () => {
    const webpackConfig = { /* mock webpack config */ };
    const assetsMap = { /* mock assets map */ };
    const options = { baseHref: { enabled: true } };

    const result = processWebpackBaseHref(webpackConfig, assetsMap, options);

    expect(pathHandler.detectBasePathFromWebpack).toHaveBeenCalledWith(webpackConfig, options);
    expect(pathHandler.transformAssetPathsWithBase).toHaveBeenCalledWith(assetsMap, '/detected-base/');
    expect(result).toEqual({ ...assetsMap, transformed: true });
  });

  test('passes options to detectBasePathFromWebpack', () => {
    const webpackConfig = { /* mock webpack config */ };
    const assetsMap = { /* mock assets map */ };
    const options = { baseHref: { path: '/custom-base/' } };

    processWebpackBaseHref(webpackConfig, assetsMap, options);

    expect(pathHandler.detectBasePathFromWebpack).toHaveBeenCalledWith(webpackConfig, options);
  });

  test('handles undefined options gracefully', () => {
    const webpackConfig = { /* mock webpack config */ };
    const assetsMap = { /* mock assets map */ };

    processWebpackBaseHref(webpackConfig, assetsMap);

    expect(pathHandler.detectBasePathFromWebpack).toHaveBeenCalledWith(webpackConfig, undefined);
  });
});