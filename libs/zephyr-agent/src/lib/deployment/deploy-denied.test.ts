import { describe, expect, it } from '@rstest/core';
import { ZeErrors } from '../errors/codes';
import { ZephyrError } from '../errors/zephyr-error';
import {
  deployDeniedError,
  environmentDeniedError,
  isDeniedOutcome,
} from './deploy-denied';

const ids = {
  app: '0190a1b2-0000-7000-8000-000000000001',
  version: '0190a1b2-0000-7000-8000-000000000002',
  prod: '0190a1b2-0000-7000-8000-000000000010',
  staging: '0190a1b2-0000-7000-8000-000000000011',
  dev: '0190a1b2-0000-7000-8000-000000000012',
  profile: '0190a1b2-0000-7000-8000-000000000020',
  tag: '0190a1b2-0000-7000-8000-000000000030',
  admin1: '0190a1b2-0000-7000-8000-000000000041',
  admin2: '0190a1b2-0000-7000-8000-000000000042',
};

const app = { name: 'checkout-web', uid: 'checkout-web.shop.acme' };

/** An upload `outcome.denied` entry as the API sends it: contact ids only. */
function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    environment: { id: ids.prod, name: 'production', type: 'production' },
    profile: { id: ids.profile, name: 'checkout / web / production' },
    requiredRole: 'member',
    reason: 'no_grant',
    contacts: [{ id: ids.admin1 }, { id: ids.admin2 }],
    moreContacts: 2,
    ...overrides,
  };
}

function uploadDenial(denied: unknown, ignoredEnvs?: unknown): string {
  return deployDeniedError(app, {
    outcome: {
      result: 'denied',
      version: { id: ids.version, snapshotId: 'snapshot-key' },
      denied,
    },
    ignoredEnvs,
  }).message;
}

describe('deployDeniedError', () => {
  it('is ZE10038 with the app, each environment, its profile and role, and whom to ask', () => {
    const error = deployDeniedError(app, {
      outcome: { result: 'denied', version: { id: ids.version }, denied: [entry()] },
    });

    expect(ZephyrError.is(error, ZeErrors.ERR_DEPLOY_DENIED)).toBe(true);
    expect(error.code).toBe('ZE10038');
    expect(error.message).toContain(
      [
        'Deploy denied for checkout-web (version kept, nothing moved)',
        '  production  profile "checkout / web / production"  needs the Member role',
        '  contact: an org admin (4 in this org; see their names in Zephyr)',
      ].join('\n')
    );
  });

  it('never prints contact names, also when the body still has them', () => {
    const text = uploadDenial([
      entry({ contacts: [{ id: ids.admin1, name: 'Alex Kim' }], moreContacts: 0 }),
    ]);

    expect(text).not.toContain('Alex Kim');
    expect(text).toMatch(
      / {2}contact: an org admin \(1 in this org; see their names in Zephyr\)$/
    );
  });

  it('asks for an org admin without a count when no contact is known', () => {
    expect(
      uploadDenial([entry({ reason: 'no_seat', contacts: [], moreContacts: 0 })])
    ).toMatch(/ {2}contact: an org admin$/);
  });

  it('counts a contact with a bad id instead of hiding the entry', () => {
    const text = uploadDenial([
      entry({ contacts: [{ id: 'not-a-uuid' }], moreContacts: 2 }),
    ]);

    expect(text).toContain('  production  profile "checkout / web / production"');
    expect(text).toContain('contact: an org admin (3 in this org;');
  });

  it('replaces control characters, so a name cannot add lines to the CI log', () => {
    const text = uploadDenial([
      entry({
        environment: {
          id: ids.prod,
          name: 'prod\n::error::fake\u001b[31m',
          type: 'production',
        },
      }),
    ]);

    expect(text).toContain('  prod ::error::fake [31m  profile');
    expect(text).not.toMatch(/^::error::/m);
    expect(text).not.toContain('\u001b');
  });

  it('replaces bidirectional controls and line separators', () => {
    const text = uploadDenial([
      entry({
        environment: { id: ids.prod, name: 'prod\u202eution\u2028x', type: 'production' },
      }),
    ]);

    expect(text).toContain('  prod ution x  profile');
  });

  it('names the tag an environment follows', () => {
    expect(
      uploadDenial([entry({ viaTag: { id: ids.tag, name: 'web_latest' } })])
    ).toContain('  production (follows tag "web_latest")  profile');
  });

  it('labels the Maintainer role', () => {
    expect(uploadDenial([entry({ requiredRole: 'maintainer' })])).toContain(
      'needs the Maintainer role'
    );
  });

  it.each([
    ['no_seat', 'needs a seat; ask an org admin'],
    ['no_app_edit_role', 'needs the app edit role; ask an org admin'],
    ['org_admin_required', 'needs an org admin'],
  ])('gives the fix for reason %s', (reason, text) => {
    const message = uploadDenial([entry({ reason })]);

    expect(message).toContain(
      `production  profile "checkout / web / production"  ${text}`
    );
  });

  it('asks for the Maintainer role when the reason is maintainer_required', () => {
    expect(
      uploadDenial([entry({ reason: 'maintainer_required', requiredRole: 'maintainer' })])
    ).toContain('profile "checkout / web / production"  needs the Maintainer role');
  });

  it('says the profile is unknown when the API sends none', () => {
    expect(uploadDenial([entry({ profile: null, reason: 'no_seat' })])).toContain(
      '  production  profile unknown  needs a seat; ask an org admin'
    );
  });

  it('does not guess a fix from the minimal entry the API sends without details', () => {
    const text = uploadDenial([
      entry({ profile: null, reason: 'no_grant', contacts: [], moreContacts: 0 }),
    ]);

    expect(text).toContain('  production  details not available');
    expect(text).not.toContain('needs the Member role');
  });

  it('names a denied environment that outcome.denied left out, once', () => {
    const text = uploadDenial(
      [entry()],
      [
        { id: ids.prod, name: 'production', reason: 'denied' },
        { id: ids.staging, name: 'staging', reason: 'denied' },
        { id: ids.dev, name: 'development', reason: 'held' },
        { id: 'hand-seeded-1', name: 'legacy', reason: 'denied' },
      ]
    );

    expect(text).toContain('  staging  details not available');
    expect(text).toContain('  legacy  details not available');
    expect(text).not.toContain('development');
    expect(text.match(/^ {2}production/gm)).toHaveLength(1);
  });

  it('prints a malformed entry by name and keeps the others', () => {
    const text = uploadDenial([
      entry({
        moreContacts: -1,
        environment: { id: ids.staging, name: 'staging', type: 'staging' },
      }),
      entry({
        reason: 'new_reason',
        environment: { id: ids.dev, name: 'dev', type: 'development' },
      }),
      entry({
        viaTag: { id: 'not-a-uuid', name: 'web_latest' },
        environment: { id: ids.prod, name: 'prod', type: 'production' },
      }),
      entry(),
    ]);

    expect(text).toContain('  staging  details not available');
    expect(text).toContain('  dev  details not available');
    expect(text).toContain('  prod  details not available');
    expect(text).toContain('  production  profile "checkout / web / production"');
  });

  it.each([
    ['a null entry', [null]],
    ['a string', 'denied'],
    ['an entry without an environment', [{ reason: 'no_grant' }]],
  ])('does not throw on %s', (_label, denied) => {
    expect(uploadDenial(denied, null)).toContain(
      'details not available; see the application audit log in Zephyr'
    );
  });

  it('does not throw on a missing or malformed outcome', () => {
    expect(() =>
      deployDeniedError(app, { outcome: null, ignoredEnvs: 'x' })
    ).not.toThrow();
  });

  it('puts the app, the version and the denied environments on the error data', () => {
    const error = deployDeniedError(app, {
      outcome: { result: 'denied', version: { id: ids.version }, denied: [entry()] },
      ignoredEnvs: [{ id: ids.staging, name: 'staging', reason: 'denied' }],
    });

    expect(error.data).toMatchObject({
      applicationUid: app.uid,
      versionId: ids.version,
      deniedEnvironmentIds: [ids.prod, ids.staging],
    });
  });
});

describe('environmentDeniedError', () => {
  const legacyBody = {
    code: 'ENVIRONMENT_DENIED',
    message: 'Deploying to "production" needs the Member role; ask an org admin',
    environments: [
      entry({ contacts: [{ id: ids.admin1, name: 'Alex Kim' }], moreContacts: 0 }),
    ],
  };

  it('formats a 403 ENVIRONMENT_DENIED body without naming the action or the contacts', () => {
    const error = environmentDeniedError(legacyBody);

    expect(error?.code).toBe('ZE10038');
    expect(error?.message).toContain(
      [
        'Denied by a permission profile (nothing changed)',
        '  production  profile "checkout / web / production"  needs the Member role',
        '  contact: an org admin (1 in this org; see their names in Zephyr)',
      ].join('\n')
    );
    expect(error?.message).not.toContain('Deploy denied');
    expect(error?.message).not.toContain('Alex Kim');
  });

  it('prints the Problem Details title and detail', () => {
    const error = environmentDeniedError({
      ...legacyBody,
      type: 'https://docs.zephyr-cloud.io/problems/environment-denied',
      title: 'Environment denied',
      status: 403,
      detail: 'A permission profile protects "production".',
    });

    expect(error?.message).toContain(
      '  Environment denied: A permission profile protects "production".'
    );
  });

  it('prints a Problem Details title alone, next to the gateway status member', () => {
    const error = environmentDeniedError({
      ...legacyBody,
      status: 'denied',
      title: 'Environment denied',
    });

    expect(error?.message).toContain(
      'Denied by a permission profile (nothing changed)\n  Environment denied\n'
    );
  });

  it('prints the legacy message only when no environment can be read', () => {
    expect(environmentDeniedError(legacyBody)?.message).not.toContain(legacyBody.message);
    expect(
      environmentDeniedError({ ...legacyBody, environments: [] })?.message
    ).toContain(`  ${legacyBody.message}`);
  });

  it('still reports a denial when the environments are malformed', () => {
    const error = environmentDeniedError({
      code: 'ENVIRONMENT_DENIED',
      environments: [null],
    });

    expect(error?.code).toBe('ZE10038');
    expect(error?.message).toContain('details not available');
  });

  it('is undefined for any other body', () => {
    expect(
      environmentDeniedError({ code: 'FORBIDDEN', environments: [] })
    ).toBeUndefined();
    expect(environmentDeniedError('Forbidden')).toBeUndefined();
    expect(environmentDeniedError(undefined)).toBeUndefined();
  });
});

describe('isDeniedOutcome', () => {
  it('decides from result only', () => {
    expect(isDeniedOutcome({ result: 'denied' })).toBe(true);
    expect(isDeniedOutcome({ result: 'denied', denied: [] })).toBe(true);
    expect(isDeniedOutcome({ result: 'deployed', denied: [entry()] })).toBe(false);
    expect(isDeniedOutcome(undefined)).toBe(false);
    expect(isDeniedOutcome('denied')).toBe(false);
  });
});
