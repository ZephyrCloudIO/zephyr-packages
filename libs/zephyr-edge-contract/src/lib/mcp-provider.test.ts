import { describe, expect, it } from '@rstest/core';
import {
  ZEPHYR_BUILD_TARGETS,
  ZEPHYR_EVAL_RESULTS_FORMAT,
  ZEPHYR_MCP_CATALOG_FILENAME,
  ZEPHYR_MCP_MANIFEST_VERSION,
  ZEPHYR_MCP_PROVIDER_FILENAME,
  ZEPHYR_MCP_RUNTIME_ENTRY,
} from '../index';

describe('MCP provider contract', () => {
  it('exposes the M1 file names and versions', () => {
    expect(ZEPHYR_MCP_PROVIDER_FILENAME).toBe('mcp-provider.json');
    expect(ZEPHYR_MCP_CATALOG_FILENAME).toBe('catalog.json');
    expect(ZEPHYR_MCP_RUNTIME_ENTRY).toBe('tools/index.js');
    expect(ZEPHYR_MCP_MANIFEST_VERSION).toBe(1);
    expect(ZEPHYR_EVAL_RESULTS_FORMAT).toBe('zephyr-evals/v1');
  });

  it('adds no build target for MCP providers', () => {
    expect(ZEPHYR_BUILD_TARGETS).toEqual(['web', 'ios', 'android', 'tap-app']);
  });
});
