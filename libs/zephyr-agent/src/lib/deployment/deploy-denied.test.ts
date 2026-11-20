import { describe, expect, it } from '@rstest/core';
import type { DeniedEnvironment, PublishOutcome } from 'zephyr-edge-contract';
import { ZeErrors } from '../errors/codes';
import { ZephyrError } from '../errors/zephyr-error';
import {
  deployDeniedError,
  environmentDeniedError,
  formatDeployDenied,
  isDeniedOutcome,
  isEnvironmentDeniedResponse,
} from './deploy-denied';

function denied(overrides: Partial<DeniedEnvironment> = {}): DeniedEnvironment {
  return {
    environment: { id: 'env-prod', name: 'production', type: 'production' },
    profile: { id: 'profile-1', name: 'checkout / web / production' },
    requiredRole: 'member',
    reason: 'no_grant',
    contacts: [
      { id: 'user-1', name: 'Alex Kim' },
      { id: 'user-2', name: 'Sam Lee' },
    ],
    moreContacts: 2,
    ...overrides,
  };
}

function outcome(entries: DeniedEnvironment[]): PublishOutcome {
  return {
    result: 'denied',
    version: { id: 'version-1', snapshotId: 'snapshot-1' },
    denied: entries,
  };
}

describe('formatDeployDenied', () => {
  it('prints each environment with its profile and role, then the contacts', () => {
    expect(formatDeployDenied('Deploy denied for checkout-web', [denied()])).toBe(
      [
        'Deploy denied for checkout-web',
        '  production  profile "checkout / web / production"  needs Member',
        '  contact: Alex Kim, Sam Lee, and 2 more org admins',
      ].join('\n')
    );
  });

  it('names the tag an environment follows', () => {
    const text = formatDeployDenied('heading', [
      denied({ viaTag: { id: 'tag-1', name: 'web_latest' } }),
    ]);

    expect(text).toContain('production (follows tag "web_latest")');
  });

  it('asks for a seat instead of a role when the uploader has none', () => {
    const text = formatDeployDenied('heading', [denied({ reason: 'no_seat' })]);

    expect(text).toContain('needs a seat; ask an org admin');
    expect(text).not.toContain('needs Member');
  });

  it('labels the maintainer role', () => {
    expect(
      formatDeployDenied('heading', [denied({ requiredRole: 'maintainer' })])
    ).toContain('needs Maintainer');
  });

  it('says when an environment has no profile', () => {
    expect(formatDeployDenied('heading', [denied({ profile: null })])).toContain(
      'production  no profile  needs Member'
    );
  });

  it('falls back to an org admin when no contact is known', () => {
    expect(
      formatDeployDenied('heading', [denied({ contacts: [], moreContacts: 0 })])
    ).toContain('  contact: an org admin');
  });

  it('uses the singular for one more admin', () => {
    expect(formatDeployDenied('heading', [denied({ moreContacts: 1 })])).toContain(
      'Sam Lee, and 1 more org admin'
    );
  });

  it('lists environments without details by name', () => {
    expect(formatDeployDenied('heading', [], ['staging'])).toContain(
      '  staging  details not available'
    );
  });

  it('points to the audit log when nothing can be listed', () => {
    expect(formatDeployDenied('heading', [])).toContain(
      'details not available; see the application audit log in Zephyr'
    );
  });
});

describe('deployDeniedError', () => {
  it('is ZE10038 with the app name and the denied environments', () => {
    const error = deployDeniedError('checkout-web', outcome([denied()]));

    expect(ZephyrError.is(error, ZeErrors.ERR_DEPLOY_DENIED)).toBe(true);
    expect(error.code).toBe('ZE10038');
    expect(error.message).toContain(
      'Deploy denied for checkout-web (version kept, nothing moved)'
    );
    expect(error.message).toContain('production  profile');
  });

  it('names a denied environment that outcome.denied left out', () => {
    const error = deployDeniedError('checkout-web', outcome([denied()]), [
      { id: 'env-prod', name: 'production', reason: 'denied' },
      { id: 'env-stg', name: 'staging', reason: 'denied' },
      { id: 'env-dev', name: 'development', reason: 'held' },
    ]);

    expect(error.message).toContain('  staging  details not available');
    expect(error.message).not.toContain('development');
    expect(error.message.match(/^ {2}production/gm)).toHaveLength(1);
  });
});

describe('environmentDeniedError', () => {
  it('formats a 403 ENVIRONMENT_DENIED body', () => {
    const error = environmentDeniedError({
      code: 'ENVIRONMENT_DENIED',
      message: 'Deploy denied',
      environments: [denied()],
    });

    expect(error.code).toBe('ZE10038');
    expect(error.message).toContain('Deploy denied (nothing moved): Deploy denied');
    expect(error.message).toContain('needs Member');
  });
});

describe('guards', () => {
  it('recognizes an ENVIRONMENT_DENIED body only', () => {
    expect(
      isEnvironmentDeniedResponse({ code: 'ENVIRONMENT_DENIED', environments: [] })
    ).toBe(true);
    expect(isEnvironmentDeniedResponse({ code: 'FORBIDDEN', environments: [] })).toBe(
      false
    );
    expect(isEnvironmentDeniedResponse({ code: 'ENVIRONMENT_DENIED' })).toBe(false);
    expect(isEnvironmentDeniedResponse('Forbidden')).toBe(false);
  });

  it('recognizes a denied outcome only', () => {
    expect(isDeniedOutcome({ result: 'denied' })).toBe(true);
    expect(isDeniedOutcome({ result: 'deployed' })).toBe(false);
    expect(isDeniedOutcome(undefined)).toBe(false);
  });
});
