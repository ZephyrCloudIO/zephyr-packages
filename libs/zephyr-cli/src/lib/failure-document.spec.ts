import { describe, expect, it } from '@rstest/core';
import { ZeErrors, ZephyrError } from 'zephyr-agent';
import {
  createFailureDocument,
  FAILURE_DOCUMENT_SCHEMA_VERSION,
} from './failure-document';

describe('createFailureDocument', () => {
  it('reports an unreachable Zephyr with its code and category', () => {
    const error = new ZephyrError(ZeErrors.ERR_ZEPHYR_UNREACHABLE, {
      method: 'GET',
      url: 'https://api.example.test/build',
      detail: 'Connection refused (ECONNREFUSED)',
      hint: 'Retry later.',
    });

    expect(createFailureDocument(error)).toEqual({
      schemaVersion: FAILURE_DOCUMENT_SCHEMA_VERSION,
      ok: false,
      error: {
        code: 'ZE50001',
        kind: 'unreachable',
        message: expect.stringContaining('Zephyr cannot be reached'),
      },
    });
    expect(createFailureDocument(error).error).not.toHaveProperty('reason');
  });

  it('keeps the category of the root cause behind a wrapper error', () => {
    const cause = new ZephyrError(ZeErrors.ERR_ZEPHYR_UNREACHABLE, {
      method: 'GET',
      url: 'https://api.example.test/build',
      detail: 'HTTP 503',
      hint: 'Retry later.',
    });
    const wrapper = new ZephyrError(ZeErrors.ERR_LOAD_APP_CONFIG, { cause });

    expect(createFailureDocument(wrapper).error).toMatchObject({
      code: wrapper.code,
      reason: 'ZE50001',
      kind: 'unreachable',
    });
  });

  it('reports the kept version URL of a denied deploy', () => {
    const denial = new ZephyrError(ZeErrors.ERR_DEPLOY_DENIED, {
      message: 'Deploy denied for app (version kept, nothing moved)',
      data: { versionUrl: 'https://app-v1.edge.example.test' },
    });

    expect(FAILURE_DOCUMENT_SCHEMA_VERSION).toBe('1.1.0');
    expect(createFailureDocument(denial).error).toMatchObject({
      code: 'ZE10038',
      versionUrl: 'https://app-v1.edge.example.test',
    });
  });

  it('reports the kept version URL behind a wrapper error', () => {
    const cause = new ZephyrError(ZeErrors.ERR_DEPLOY_DENIED, {
      message: 'denied',
      data: { versionUrl: 'https://app-v1.edge.example.test' },
    });
    const wrapper = new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
      type: 'build stats',
      cause,
    });

    expect(createFailureDocument(wrapper).error.versionUrl).toBe(
      'https://app-v1.edge.example.test'
    );
  });

  it('has no versionUrl when no version was kept', () => {
    expect(createFailureDocument(new Error('boom')).error).not.toHaveProperty(
      'versionUrl'
    );
  });

  it('reports a plain error as unknown without colors or secrets', () => {
    const { error } = createFailureDocument(
      new Error('Directory does not exist\nAuthorization: Bearer abc.def.ghi')
    );

    expect(error.code).toBe('ZE00000');
    expect(error.kind).toBe('unknown');
    expect(error.message).not.toContain('abc.def.ghi');
    // eslint-disable-next-line no-control-regex
    expect(error.message).not.toMatch(/\u001b\[/u);
  });

  it('accepts a thrown string', () => {
    expect(createFailureDocument('boom').error.message).toBe('boom');
  });

  it('strips terminal colors', () => {
    expect(createFailureDocument(new Error('\u001b[31mred\u001b[0m')).error.message).toBe(
      'red'
    );
  });
});
