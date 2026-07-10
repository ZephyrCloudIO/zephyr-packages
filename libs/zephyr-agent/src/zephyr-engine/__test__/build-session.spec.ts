import { describe, expect, it, rs } from '@rstest/core';
import type { ZeBuildAsset, ZeBuildAssetsMap } from 'zephyr-edge-contract';
import { ApplicationContext, ApplicationContextRegistry } from '../application-context';
import {
  BuildParticipantFailedError,
  BuildSessionAbortedError,
  BuildSessionAssetCollisionError,
  BuildSessionNotReadyError,
  BuildSessionRollbackError,
  BuildSessionStateError,
} from '../build-session';

function asset(path: string, hash = path, content = path): ZeBuildAsset {
  return {
    path,
    hash,
    extname: path.includes('.') ? `.${path.split('.').pop()}` : '',
    size: Buffer.byteLength(content),
    buffer: Buffer.from(content),
  };
}

function assets(...values: ZeBuildAsset[]): ZeBuildAssetsMap {
  return Object.fromEntries(values.map((value) => [value.hash, value]));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('BuildSession', () => {
  it('waits for every required participant and postprocessor regardless of order', async () => {
    const events: string[] = [];
    const context = new ApplicationContext({
      applicationUid: 'org.project.app',
      prepare: () => {
        events.push('prepare');
      },
      publish: (publication) => {
        events.push(`publish:${Object.keys(publication.assetsMap).length}`);
        return 'deployed';
      },
      finish: (_publication, result) => {
        events.push(`finish:${result}`);
      },
    });
    const session = context.beginBuild({
      invocationId: 'build-1',
      participants: [
        { name: 'client', role: 'csr' },
        { name: 'server', role: 'ssr' },
      ],
      postprocessors: ['tanstack'],
    });

    const published = session.publish();
    session.contribute({
      participant: 'server',
      key: 'server-output',
      assetsMap: assets(asset('server/index.mjs')),
    });
    session.completeParticipant('server');
    session.completePostprocess('tanstack');
    await Promise.resolve();
    expect(events).toEqual([]);
    expect(session.readiness).toEqual({
      ready: false,
      pendingParticipants: ['client'],
      pendingPostprocessors: [],
    });

    session.contribute({
      participant: 'client',
      key: 'client-output',
      assetsMap: assets(asset('client/index.js')),
    });
    session.completeParticipant('client');

    await expect(published).resolves.toBe('deployed');
    expect(events).toEqual(['prepare', 'publish:2', 'finish:deployed']);
    expect(session.status).toBe('published');
  });

  it('returns one in-flight publish promise to concurrent callers', async () => {
    const upload = deferred<string>();
    const publish = rs.fn(() => upload.promise);
    const prepare = rs.fn();
    const finish = rs.fn();
    const context = new ApplicationContext({
      applicationUid: 'org.project.app',
      prepare,
      publish,
      finish,
    });
    const session = context.beginBuild({
      participants: [{ name: 'client' }],
    });
    session.completeParticipant('client');

    const first = session.publish();
    const second = session.publish();
    expect(first).toBe(second);
    await Promise.resolve();
    await Promise.resolve();
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(1);

    upload.resolve('url');
    await expect(Promise.all([first, second])).resolves.toEqual(['url', 'url']);
    expect(finish).toHaveBeenCalledTimes(1);
    expect(session.publish()).toBe(first);
  });

  it('deduplicates identical assets and rejects same-path hash collisions', async () => {
    const publish = rs.fn();
    const prepare = rs.fn();
    const context = new ApplicationContext({
      applicationUid: 'org.project.app',
      prepare,
      publish,
    });
    const session = context.beginBuild({
      participants: [{ name: 'client' }, { name: 'server' }],
    });
    const shared = asset('static/shared.js', 'shared-hash', 'shared');
    session.contribute({
      participant: 'client',
      key: 'output',
      assetsMap: assets(shared),
    });
    session.contribute({
      participant: 'server',
      key: 'output',
      assetsMap: assets({ ...shared, buffer: Buffer.from('shared') }),
    });
    session.completeParticipant('client');
    session.completeParticipant('server');

    const publication = session.seal();
    expect(Object.keys(publication.assetsMap)).toEqual(['shared-hash']);

    const colliding = context.beginBuild({
      participants: [{ name: 'client' }, { name: 'server' }],
    });
    colliding.contribute({
      participant: 'client',
      key: 'output',
      assetsMap: assets(asset('index.js', 'hash-a', 'a')),
    });
    colliding.contribute({
      participant: 'server',
      key: 'output',
      assetsMap: assets(asset('index.js', 'hash-b', 'b')),
    });
    colliding.completeParticipant('client');
    colliding.completeParticipant('server');

    await expect(colliding.publish()).rejects.toBeInstanceOf(
      BuildSessionAssetCollisionError
    );
    expect(prepare).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('normalizes safe relative asset paths and rejects traversal or absolute paths', () => {
    const context = new ApplicationContext({
      applicationUid: 'org.project.app',
      publish: rs.fn(),
    });
    const normalized = context.beginBuild({
      invocationId: 'normalized',
      participants: [{ name: 'client' }],
    });
    normalized.contribute({
      participant: 'client',
      key: 'output',
      assetsMap: assets(asset('client\\.\\assets//app.js')),
    });
    normalized.completeParticipant('client');
    expect(Object.values(normalized.seal().assetsMap)[0]?.path).toBe(
      'client/assets/app.js'
    );

    for (const invalidPath of [
      '../secret.js',
      'client/../../secret.js',
      '/absolute.js',
      'C:\\absolute.js',
      '\\\\server\\share.js',
    ]) {
      const session = context.beginBuild({
        invocationId: `invalid:${invalidPath}`,
        participants: [{ name: 'client' }],
      });
      expect(() =>
        session.contribute({
          participant: 'client',
          key: 'output',
          assetsMap: assets(asset(invalidPath)),
        })
      ).toThrow(BuildSessionStateError);
    }
  });

  it('reports typed readiness instead of sealing an incomplete build', () => {
    const context = new ApplicationContext({
      applicationUid: 'org.project.app',
      publish: rs.fn(),
    });
    const session = context.beginBuild({
      participants: [{ name: 'client' }, { name: 'optional-worker', required: false }],
      postprocessors: ['framework'],
    });

    expect(() => session.seal()).toThrow(BuildSessionNotReadyError);
    try {
      session.seal();
    } catch (error: unknown) {
      expect((error as BuildSessionNotReadyError).readiness).toEqual({
        ready: false,
        pendingParticipants: ['client'],
        pendingPostprocessors: ['framework'],
      });
    }
  });

  it('fails closed when a participant fails and never prepares or publishes', async () => {
    const prepare = rs.fn();
    const publish = rs.fn();
    const onFailure = rs.fn();
    const context = new ApplicationContext({
      applicationUid: 'org.project.app',
      prepare,
      publish,
      onFailure,
    });
    const session = context.beginBuild({
      participants: [{ name: 'client' }, { name: 'server' }],
    });
    const publication = session.publish();

    session.completeParticipant('client');
    session.fail('server', new Error('server compiler failed'));

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(
      session.identity,
      expect.any(BuildParticipantFailedError)
    );

    await expect(publication).rejects.toBeInstanceOf(BuildParticipantFailedError);
    expect(session.status).toBe('failed');
    expect(prepare).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('surfaces rollback failure synchronously and blocks a superseding generation', () => {
    const rollbackFailure = new Error('engine reset failed');
    const context = new ApplicationContext({
      applicationUid: 'org.project.app',
      publish: rs.fn(),
      onFailure: () => {
        throw rollbackFailure;
      },
    });
    const failed = context.beginBuild({
      invocationId: 'watch',
      generation: 0,
      participants: [{ name: 'client' }],
    });

    let surfaced: unknown;
    try {
      failed.fail('client', new Error('compiler failed'));
    } catch (error: unknown) {
      surfaced = error;
    }

    expect(surfaced).toBeInstanceOf(BuildSessionRollbackError);
    expect((surfaced as BuildSessionRollbackError).rollbackError).toBe(rollbackFailure);
    expect(failed.failure).toBe(surfaced);
    expect(() => failed.fail('client', new Error('duplicate failure'))).toThrow(
      surfaced as Error
    );
    expect(() => context.abortCurrent('shutdown')).toThrow(surfaced as Error);
    expect(() =>
      context.beginBuild({
        invocationId: 'watch',
        generation: 1,
        participants: [{ name: 'client' }],
      })
    ).toThrow(surfaced as Error);
    expect(context.currentBuild).toBe(failed);
  });

  it('surfaces abort rollback failure before superseding a pending generation', () => {
    const context = new ApplicationContext({
      applicationUid: 'org.project.app',
      publish: rs.fn(),
      onFailure: () => {
        throw new Error('abort cleanup failed');
      },
    });
    const pending = context.beginBuild({
      invocationId: 'watch',
      generation: 4,
      participants: [{ name: 'client' }],
    });

    expect(() =>
      context.beginBuild({
        invocationId: 'watch',
        generation: 5,
        participants: [{ name: 'client' }],
      })
    ).toThrow(BuildSessionRollbackError);
    expect(context.currentBuild).toBe(pending);
    expect(pending.status).toBe('aborted');
  });

  it('isolates applications even when invocation identities match', async () => {
    const publications: string[] = [];
    const makeContext = (applicationUid: string) =>
      new ApplicationContext({
        applicationUid,
        publish: (publication) => {
          publications.push(publication.identity.applicationUid);
        },
      });
    const one = makeContext('org.project.one').beginBuild({
      invocationId: 'same-invocation',
      participants: [{ name: 'client' }],
    });
    const two = makeContext('org.project.two').beginBuild({
      invocationId: 'same-invocation',
      participants: [{ name: 'client' }],
    });
    one.completeParticipant('client');
    two.completeParticipant('client');

    await Promise.all([one.publish(), two.publish()]);
    expect(publications).toEqual(['org.project.one', 'org.project.two']);
  });

  it('rendezvous on the same session only when its barrier definition matches', () => {
    const context = new ApplicationContext({
      applicationUid: 'org.project.app',
      publish: rs.fn(),
    });
    const first = context.beginBuild({
      invocationId: 'build-1',
      generation: 0,
      participants: [
        { name: 'server', role: 'ssr' },
        { name: 'client', role: 'csr' },
      ],
      postprocessors: ['framework'],
    });
    const same = context.beginBuild({
      invocationId: 'build-1',
      generation: 0,
      participants: [
        { name: 'client', role: 'csr' },
        { name: 'server', role: 'ssr' },
      ],
      postprocessors: ['framework'],
    });

    expect(same).toBe(first);
    expect(() =>
      context.beginBuild({
        invocationId: 'build-1',
        generation: 0,
        participants: [{ name: 'client', role: 'csr' }],
        postprocessors: ['framework'],
      })
    ).toThrow(/participants or postprocessors differ/);
  });

  it('starts watch generations empty and drops replaced keyed output', async () => {
    const publications: string[][] = [];
    const context = new ApplicationContext({
      applicationUid: 'org.project.app',
      publish: (publication) => {
        publications.push(Object.values(publication.assetsMap).map(({ path }) => path));
      },
    });
    const first = context.beginBuild({
      invocationId: 'watch',
      generation: 0,
      participants: [{ name: 'client' }],
    });
    first.contribute({
      participant: 'client',
      key: 'output',
      assetsMap: assets(asset('stale.js'), asset('shared.js')),
    });
    first.completeParticipant('client');
    await first.publish();

    const second = context.beginBuild({
      invocationId: 'watch',
      generation: 1,
      participants: [{ name: 'client' }],
    });
    second.contribute({
      participant: 'client',
      key: 'output',
      assetsMap: assets(asset('replaced-before-completion.js')),
    });
    second.contribute({
      participant: 'client',
      key: 'output',
      assetsMap: assets(asset('fresh.js')),
    });
    second.completeParticipant('client');
    await second.publish();

    expect(publications).toEqual([['stale.js', 'shared.js'], ['fresh.js']]);
  });

  it('aborts a pending generation when a newer watch generation starts', async () => {
    const publish = rs.fn();
    const context = new ApplicationContext({
      applicationUid: 'org.project.app',
      publish,
    });
    const stale = context.beginBuild({
      invocationId: 'watch',
      generation: 10,
      participants: [{ name: 'client' }],
    });
    const pending = stale.publish();
    const fresh = context.beginBuild({
      invocationId: 'watch',
      generation: 11,
      participants: [{ name: 'client' }],
    });

    await expect(pending).rejects.toBeInstanceOf(BuildSessionAbortedError);
    expect(stale.status).toBe('aborted');
    fresh.completeParticipant('client');
    await fresh.publish();
    expect(publish).toHaveBeenCalledTimes(1);
  });
});

describe('ApplicationContextRegistry', () => {
  it('single-flights async engine initialization across compiler instances', async () => {
    const registry = new ApplicationContextRegistry();
    const initialized = deferred<ApplicationContext>();
    const create = rs.fn(() => initialized.promise);
    const client = registry.getOrCreateAsync({ contextKey: 'compiler-group' }, create);
    const server = registry.getOrCreateAsync(
      {
        contextKey: 'compiler-group',
        applicationUid: 'org.project.app',
        invocationId: 'build-1',
      },
      create
    );
    await Promise.resolve();
    expect(create).toHaveBeenCalledTimes(1);

    const context = new ApplicationContext({
      applicationUid: 'org.project.app',
      publish: rs.fn(),
    });
    initialized.resolve(context);

    await expect(Promise.all([client, server])).resolves.toEqual([context, context]);
    expect(
      registry.get({
        applicationUid: 'org.project.app',
        invocationId: 'build-1',
      })
    ).toBe(context);
  });

  it('rendezvous by an early key, associates identity, and explicitly disposes', () => {
    const registry = new ApplicationContextRegistry();
    const create = rs.fn(
      () =>
        new ApplicationContext({
          applicationUid: 'org.project.app',
          publish: rs.fn(),
        })
    );
    const early = registry.getOrCreate({ contextKey: 'compiler-group' }, create);
    const sameEarly = registry.getOrCreate({ contextKey: 'compiler-group' }, create);
    registry.associate(
      { contextKey: 'compiler-group' },
      { applicationUid: 'org.project.app', invocationId: 'build-1' }
    );
    const byIdentity = registry.get({
      applicationUid: 'org.project.app',
      invocationId: 'build-1',
    });

    expect(sameEarly).toBe(early);
    expect(byIdentity).toBe(early);
    expect(create).toHaveBeenCalledTimes(1);
    expect(registry.dispose({ contextKey: 'compiler-group' })).toBe(true);
    expect(
      registry.get({
        applicationUid: 'org.project.app',
        invocationId: 'build-1',
      })
    ).toBeNull();
  });
});
