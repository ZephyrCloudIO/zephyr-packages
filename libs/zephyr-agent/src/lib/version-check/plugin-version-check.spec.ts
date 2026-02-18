import { describe, expect, it, jest } from '@jest/globals';
import {
  checkPluginVersionWarning,
  compareSemver,
  parseTxtFields,
  parseTxtRecord,
} from './plugin-version-check';

describe('plugin-version-check', () => {
  it('parses TXT key-value content', () => {
    const result = parseTxtFields('schema=1; latest=1.7.3; msg=Upgrade recommended');
    expect(result.get('schema')).toBe('1');
    expect(result.get('latest')).toBe('1.7.3');
    expect(result.get('msg')).toBe('Upgrade recommended');
  });

  it('parses TXT records split across chunks', () => {
    const result = parseTxtRecord([['schema=1; ', 'latest=1.7.3; msg=Upgrade now']]);
    expect(result.get('latest')).toBe('1.7.3');
    expect(result.get('msg')).toBe('Upgrade now');
  });

  it('compares semver strings', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
    expect(compareSemver('1.2.3', '1.2.4')).toBe(-1);
    expect(compareSemver('1.3.0', '1.2.4')).toBe(1);
    expect(compareSemver('v1.2.3', '1.2.4')).toBe(-1);
    expect(compareSemver('invalid', '1.2.4')).toBeNull();
  });

  it('logs warning when current version is behind latest', async () => {
    const logger = jest.fn();
    const resolveTxt = jest
      .fn<() => Promise<string[][]>>()
      .mockResolvedValue([['schema=1; latest=1.7.3; msg=Upgrade recommended']]);

    await checkPluginVersionWarning({
      resolveTxt,
      logger,
      currentVersion: '1.6.2',
    });

    expect(logger).toHaveBeenCalledTimes(1);
    expect(logger).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('Update available: 1.6.2 -> 1.7.3'),
      'build:warn:plugin_version'
    );
  });

  it('does not log warning when current version is up to date', async () => {
    const logger = jest.fn();
    const resolveTxt = jest
      .fn<() => Promise<string[][]>>()
      .mockResolvedValue([['schema=1; latest=1.7.3; msg=Upgrade recommended']]);

    await checkPluginVersionWarning({
      resolveTxt,
      logger,
      currentVersion: '1.7.3',
    });

    expect(logger).not.toHaveBeenCalled();
  });

  it('never throws when DNS resolution fails', async () => {
    const logger = jest.fn();
    const resolveTxt = jest
      .fn<() => Promise<string[][]>>()
      .mockRejectedValue(new Error('dns'));

    await expect(
      checkPluginVersionWarning({
        resolveTxt,
        logger,
        currentVersion: '1.0.0',
      })
    ).resolves.toBeUndefined();
    expect(logger).not.toHaveBeenCalled();
  });
});
