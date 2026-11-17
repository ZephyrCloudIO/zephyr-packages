import { describe, expect, it } from '@rstest/core';

import { describeLabelFallback } from '../describe_label_fallback';

const defaultEnv = { entity_type: 'environment', entity_name: 'production' } as const;

function describeFor(
  selector: string,
  resolved: Parameters<typeof describeLabelFallback>[0]['resolved'] = defaultEnv
): string | undefined {
  return describeLabelFallback({
    dependency: 'cache-test-mini',
    selector,
    target: 'ios',
    resolved,
  });
}

describe('describeLabelFallback', () => {
  it('warns when a label resolves to a different environment', () => {
    const message = describeFor('DEMO');

    expect(message).toContain('"cache-test-mini"');
    expect(message).toContain('requested "DEMO"');
    expect(message).toContain('target "ios"');
    expect(message).toContain('resolved to environment "production"');
  });

  it('strips the zephyr:app@label prefix before comparing', () => {
    expect(describeFor('zephyr:cache-test-mini@DEMO')).toContain('requested "DEMO"');
    expect(
      describeFor('zephyr:cache-test-mini@DEMO', {
        entity_type: 'tag',
        entity_name: 'DEMO',
      })
    ).toBeUndefined();
  });

  it('stays quiet when the label matched', () => {
    expect(
      describeFor('DEMO', { entity_type: 'environment', entity_name: 'DEMO' })
    ).toBeUndefined();
    expect(describeFor('dev-ios', { entity_type: 'tag', entity_name: 'dev-ios' })).toBe(
      undefined
    );
  });

  it.each(['*', 'workspace:*', 'workspace:^1.2.0'])(
    'stays quiet for non-label selector %s',
    (selector) => {
      expect(describeFor(selector)).toBeUndefined();
    }
  );

  it.each([
    '1.2.3',
    'v1.2.3',
    '1.2.3-beta.1',
    '^1.0.0',
    '~2.1',
    '>=1.0.0 <2',
    '1.x',
    '1',
  ])('stays quiet for semver selector %s', (selector) => {
    expect(describeFor(selector)).toBeUndefined();
  });

  it('stays quiet when an older resolver omits entity_name', () => {
    expect(describeFor('DEMO', {})).toBeUndefined();
    expect(describeFor('DEMO', { entity_type: 'version', entity_name: null })).toBe(
      undefined
    );
  });
});
