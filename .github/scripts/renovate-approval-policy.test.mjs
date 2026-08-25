import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyRenovateApproval } from './renovate-approval-policy.mjs';

const renovatePr = {
  author: 'app/renovate',
  baseRef: 'main',
  baseRepo: 'ZephyrCloudIO/zephyr-packages',
  body: '| Package | Type | Update | Change |\n| foo | dependencies | patch | `1.0.0` → `1.0.1` |',
  draft: false,
  headRef: 'renovate/foo-1.x',
  headRepo: 'ZephyrCloudIO/zephyr-packages',
  labels: ['dependencies'],
  title: 'chore(deps): update dependency foo to v1.0.1',
};

test('accepts bounded Renovate dependency updates', () => {
  assert.deepEqual(
    classifyRenovateApproval(renovatePr, [
      { filename: 'package.json', changes: 2 },
      { filename: 'pnpm-lock.yaml', changes: 200 },
    ]),
    {
      eligible: true,
      reason: 'bounded Renovate dependency-only update',
    }
  );
});

test('accepts the Renovate bot login used by webhook events', () => {
  const result = classifyRenovateApproval({ ...renovatePr, author: 'renovate[bot]' }, [
    { filename: '.github/workflows/ci.yml', changes: 2 },
  ]);
  assert.equal(result.eligible, true);
});

test('rejects another dependency bot', () => {
  const result = classifyRenovateApproval({ ...renovatePr, author: 'dependabot[bot]' }, [
    { filename: 'package.json', changes: 2 },
  ]);
  assert.equal(result.eligible, false);
  assert.match(result.reason, /author is not Renovate/);
});

test('rejects a Renovate branch from a fork', () => {
  const result = classifyRenovateApproval({ ...renovatePr, headRepo: 'attacker/zephyr-packages' }, [
    { filename: 'package.json', changes: 2 },
  ]);
  assert.equal(result.eligible, false);
  assert.match(result.reason, /not in this repository/);
});

test('rejects major updates reported in Renovate metadata', () => {
  const result = classifyRenovateApproval(
    {
      ...renovatePr,
      body: '| Package | Type | Update | Change |\n| foo | dependencies | major | `1` → `2` |',
    },
    [{ filename: 'package.json', changes: 2 }]
  );
  assert.equal(result.eligible, false);
  assert.match(result.reason, /major/);
});

test('rejects a Conventional Commit breaking marker', () => {
  const result = classifyRenovateApproval(
    { ...renovatePr, title: 'chore(deps)!: update dependency foo to v2' },
    [{ filename: 'package.json', changes: 2 }]
  );
  assert.equal(result.eligible, false);
  assert.match(result.reason, /title is not an allowed/);
});

test('rejects changes outside dependency metadata', () => {
  const result = classifyRenovateApproval(renovatePr, [
    { filename: 'libs/zephyr-agent/src/index.ts', changes: 2 },
  ]);
  assert.equal(result.eligible, false);
  assert.match(result.reason, /non-dependency file/);
});

test('rejects a blocked update', () => {
  const result = classifyRenovateApproval(
    { ...renovatePr, labels: ['dependencies', 'do not merge'] },
    [{ filename: 'package.json', changes: 2 }]
  );
  assert.equal(result.eligible, false);
  assert.match(result.reason, /blocking label/);
});

test('rejects oversized non-lockfile changes', () => {
  const result = classifyRenovateApproval(renovatePr, [{ filename: 'package.json', changes: 501 }]);
  assert.equal(result.eligible, false);
  assert.match(result.reason, /size limit/);
});
