import {
  ApplicationContext,
  assertTapFederationPublicationMetadata,
  normalizeBasePath,
  ZeErrors,
  ZephyrError,
  type BuildParticipant,
  type BuildSession,
  type ZeBuildAssetsMap,
  type ZephyrBuildHooks,
  type ZephyrEngine,
} from 'zephyr-agent';
import type {
  ZephyrBuildStats,
  ZephyrModuleFederationConfig,
} from 'zephyr-edge-contract';
import * as path from 'node:path';
import {
  getLegacyModuleFederationConfig,
  mergeModuleFederationBuildMetadata,
  mergeModuleFederationConfigs,
} from './federation-config-metadata';

export interface XPackParticipantDependencyPaths {
  fileDependencies: readonly string[];
  contextDependencies: readonly string[];
  missingDependencies: readonly string[];
  buildDependencies: readonly string[];
}

export interface XPackBuildContribution {
  participant: string;
  /** Compiler-local watch generation. All coordinated compilers start at zero. */
  generation?: number;
  assetsMap: ZeBuildAssetsMap;
  buildStats: ZephyrBuildStats;
  /** Every serializable MF config emitted by this compiler. */
  mfConfigs?: ZephyrModuleFederationConfig[];
  hooks?: ZephyrBuildHooks;
  dependencyPaths?: XPackParticipantDependencyPaths;
}

export interface XPackBuildCoordinatorOptions {
  snapshotType?: 'csr' | 'ssr';
  entrypoint?: string;
}

interface ContributionMetadata {
  buildStats: ZephyrBuildStats;
  mfConfigs?: ZephyrModuleFederationConfig[];
  hooks?: ZephyrBuildHooks;
  dependencyPaths?: XPackParticipantDependencyPaths;
}

export interface XPackBuildParticipant extends BuildParticipant {
  /** Participant names this compiler depends on in the MultiCompiler graph. */
  dependencies?: readonly string[];
}

type MfConfigs = ZephyrModuleFederationConfig[];

function xpackError(message: string): Error {
  return new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, { message });
}

function normalizedDependencyPath(value: string): string {
  return path.resolve(value);
}

function isWithinDirectory(filePath: string, directory: string): boolean {
  const relative = path.relative(directory, filePath);
  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

function dependencyPathsInclude(
  dependencies: XPackParticipantDependencyPaths,
  invalidatedPath: string
): boolean {
  const exactDependencies = [
    ...dependencies.fileDependencies,
    ...dependencies.missingDependencies,
    ...dependencies.buildDependencies,
  ];
  if (
    exactDependencies.some(
      (dependency) => normalizedDependencyPath(dependency) === invalidatedPath
    )
  ) {
    return true;
  }
  return dependencies.contextDependencies.some((dependency) =>
    isWithinDirectory(invalidatedPath, normalizedDependencyPath(dependency))
  );
}

function mergeUnique<T>(values: readonly (readonly T[] | undefined)[]): T[] {
  const merged: T[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    for (const item of value ?? []) {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }
  }
  return merged;
}

function mergeBuildStats(stats: readonly ZephyrBuildStats[]): ZephyrBuildStats {
  const [base, ...rest] = stats;
  if (!base) {
    throw xpackError('Cannot publish an xpack build without build statistics');
  }
  if (rest.length === 0) {
    return base;
  }

  return {
    ...base,
    modules: mergeUnique(stats.map((item) => item.modules)),
    consumes: mergeUnique(stats.map((item) => item.consumes)),
    overrides: mergeUnique(stats.map((item) => item.overrides)),
    remotes: [...new Set(stats.flatMap((item) => item.remotes ?? []))],
    federation: mergeModuleFederationBuildMetadata(stats.map((item) => item.federation)),
  };
}

function mergeMfConfigs(
  configs: readonly (MfConfigs | undefined)[]
): MfConfigs | undefined {
  const merged = mergeModuleFederationConfigs(configs);
  return merged.length > 0 ? merged : undefined;
}

function resolveServerEntrypoint(
  assetsMap: ZeBuildAssetsMap,
  configuredEntrypoint: string | undefined
): string | undefined {
  if (configuredEntrypoint) {
    const normalized = configuredEntrypoint.replace(/\\/g, '/').replace(/^\.?\/+/, '');
    const segments = normalized
      .split('/')
      .filter((segment) => segment && segment !== '.');
    if (!normalized || segments.length === 0 || segments.includes('..')) {
      throw xpackError(
        `XPack server entrypoint must be inside the snapshot: "${configuredEntrypoint}"`
      );
    }
    return segments.join('/');
  }
  const paths = new Set(Object.values(assetsMap).map((asset) => asset.path));
  const preferred = [
    'server/index.js',
    'server/index.mjs',
    'server/index.cjs',
    'ssr/index.js',
    'ssr/index.mjs',
    'ssr/index.cjs',
    'index.js',
    'index.mjs',
    'index.cjs',
  ];
  return (
    preferred.find((candidate) => paths.has(candidate)) ??
    [...paths].find((candidate) => /(^|\/)(server|index)\.(mjs|cjs|js)$/.test(candidate))
  );
}

interface ActiveXPackBuild {
  logicalGeneration: number;
  session: BuildSession<ContributionMetadata>;
  dirtyParticipants: Set<string>;
  startedParticipants: Set<string>;
  contributions: Map<string, XPackBuildContribution>;
  invalidationKeys: Set<string>;
}

interface LocalGenerationState {
  localGeneration: number;
  logicalGeneration: number;
}

/** One logical publication shared by Rspack/Webpack child compilers. */
export class XPackBuildCoordinator {
  private readonly engine: ZephyrEngine;
  private readonly context: ApplicationContext<ContributionMetadata>;
  private readonly participants: readonly BuildParticipant[];
  private readonly participantNames: Set<string>;
  private readonly dependents = new Map<string, Set<string>>();
  private readonly lastSuccessful = new Map<string, XPackBuildContribution>();
  private readonly localGenerations = new Map<string, LocalGenerationState>();
  private readonly rejectedLocalGenerations = new Map<string, Set<number>>();
  private readonly pendingRecoveryParticipants = new Set<string>();
  private readonly participantBaseHrefs = new Map<string, string>();
  private applicationBaseHref: string | undefined;
  private activeBuild: ActiveXPackBuild | undefined;
  private nextLogicalGeneration = 0;

  constructor(
    engine: ZephyrEngine,
    participants: readonly XPackBuildParticipant[],
    options: XPackBuildCoordinatorOptions = {}
  ) {
    this.engine = engine;
    this.participants = participants;
    this.participantNames = new Set(participants.map(({ name }) => name));
    for (const { name } of participants) this.dependents.set(name, new Set());
    for (const participant of participants) {
      for (const dependency of participant.dependencies ?? []) {
        this.assertParticipant(dependency);
        this.dependents.get(dependency)?.add(participant.name);
      }
    }
    this.context = new ApplicationContext<ContributionMetadata>({
      applicationUid: engine.application_uid,
      prepare: ({ generation }) =>
        generation === 0 ? undefined : engine.start_new_build(),
      publish: async (publication) => {
        const metadata = publication.contributions
          .map((contribution) => contribution.data)
          .filter((item): item is ContributionMetadata => !!item);
        const entrypoint =
          options.snapshotType === 'ssr'
            ? resolveServerEntrypoint(publication.assetsMap, options.entrypoint)
            : options.entrypoint;
        if (options.snapshotType === 'ssr' && !entrypoint) {
          throw xpackError(
            'Could not infer the server entrypoint for a coordinated xpack build'
          );
        }
        if (
          options.snapshotType === 'ssr' &&
          entrypoint &&
          !Object.values(publication.assetsMap).some((asset) => asset.path === entrypoint)
        ) {
          throw xpackError(
            `Coordinated xpack server entrypoint "${entrypoint}" was not emitted`
          );
        }
        const mfConfigs = mergeMfConfigs(metadata.map((item) => item.mfConfigs));
        const buildStats = mergeBuildStats(metadata.map((item) => item.buildStats));
        // Validate the final cross-compiler set, rather than individual participants:
        // a TAP package may place different containers in separate compilers.
        assertTapFederationPublicationMetadata({
          target: engine.env?.target,
          mfConfigs,
          federation: buildStats.federation,
        });
        await engine.upload_assets({
          assetsMap: publication.assetsMap,
          buildStats,
          mfConfig: getLegacyModuleFederationConfig(mfConfigs),
          mfConfigs,
          hooks: metadata.find((item) => item.hooks)?.hooks,
          snapshotType: options.snapshotType,
          entrypoint,
        });
      },
      finish: () => engine.build_finished(),
      onFailure: () => engine.build_failed(),
    });
  }

  /**
   * Select one application-wide snapshot base for every coordinated compiler. Root-like
   * and missing values normalize to the empty base; conflicting child bases fail before
   * compilation can publish a snapshot with paths from the last-applied plugin.
   */
  registerParticipantBaseHref(
    participant: string,
    baseHref: string | null | undefined
  ): void {
    this.assertParticipant(participant);
    // TAP descriptors lock paths relative to the package root. Compiler public paths
    // and output directories are local transport details, never package prefixes.
    if (this.engine.env?.target === 'tap-app') {
      this.participantBaseHrefs.set(participant, '');
      this.applicationBaseHref = '';
      this.engine.buildProperties.baseHref = '';
      return;
    }
    const normalizedBaseHref = normalizeBasePath(baseHref);
    const existingParticipantBase = this.participantBaseHrefs.get(participant);
    if (
      this.participantBaseHrefs.has(participant) &&
      existingParticipantBase !== normalizedBaseHref
    ) {
      throw xpackError(
        `Coordinated xpack participant "${participant}" registered conflicting application bases ` +
          `"${existingParticipantBase}" and "${normalizedBaseHref}"`
      );
    }

    if (
      this.applicationBaseHref !== undefined &&
      this.applicationBaseHref !== normalizedBaseHref
    ) {
      const [existingParticipant] = this.participantBaseHrefs.entries().next().value ?? [
        'another participant',
      ];
      throw xpackError(
        `Coordinated xpack participants "${existingParticipant}" and "${participant}" ` +
          `use conflicting application bases "${this.applicationBaseHref}" and "${normalizedBaseHref}"`
      );
    }

    if (this.applicationBaseHref === undefined) {
      this.applicationBaseHref = normalizedBaseHref;
      this.engine.buildProperties.baseHref = normalizedBaseHref;
    }
    this.participantBaseHrefs.set(participant, normalizedBaseHref);
  }

  /**
   * Open one invalidation batch before its child compilers start. Webpack/Rspack may
   * execute children sequentially (`parallelism: 1`), so all invalidated participants
   * must enter the barrier before the first child is allowed to publish.
   */
  beginBatch(participants: readonly string[]): void {
    if (participants.length === 0) return;
    for (const participant of participants) this.assertParticipant(participant);
    this.openInvalidationBatch(participants[0], participants);
  }

  /**
   * Register a child invalidation using dependencies from the last complete build. The
   * first hook therefore marks every affected child before parallelism=1 can let one fast
   * compiler publish with another child's stale output.
   */
  invalidateParticipant(participant: string, filename?: string | null): void {
    this.assertParticipant(participant);
    const affected = this.resolveAffectedParticipants(participant, filename);
    const invalidationKey = filename?.trim()
      ? `path:${normalizedDependencyPath(filename)}`
      : 'unknown';
    this.openInvalidationBatch(participant, affected, invalidationKey);
  }

  /** Mark a child compiler dirty before its compilation starts. */
  beginParticipant(participant: string, localGeneration: number): void {
    this.assertParticipant(participant);
    if (!Number.isSafeInteger(localGeneration) || localGeneration < 0) {
      throw xpackError(
        `XPack local generation must be a non-negative safe integer, received ${localGeneration}`
      );
    }

    const rejected = this.rejectedLocalGenerations.get(participant);
    if (rejected?.has(localGeneration)) {
      rejected.delete(localGeneration);
      if (this.activeBuild && !this.activeBuild.session.isTerminal) {
        this.activeBuild.session.abort(
          `Rejected failed xpack generation ${localGeneration} for "${participant}"`
        );
      }
      throw xpackError(
        `XPack generation ${localGeneration} for "${participant}" belongs to a failed logical build`
      );
    }
    for (const rejectedGeneration of rejected ?? []) {
      if (rejectedGeneration < localGeneration) rejected?.delete(rejectedGeneration);
    }

    const previous = this.localGenerations.get(participant);
    if (previous && localGeneration < previous.localGeneration) {
      throw xpackError(
        `Stale xpack generation ${localGeneration} for "${participant}"; latest is ${previous.localGeneration}`
      );
    }
    if (previous && localGeneration === previous.localGeneration) {
      if (
        this.activeBuild?.logicalGeneration === previous.logicalGeneration &&
        !this.activeBuild.session.isTerminal
      ) {
        if (!this.activeBuild.contributions.has(participant)) {
          this.activeBuild.dirtyParticipants.add(participant);
        }
        return;
      }
      throw xpackError(
        `Stale xpack generation ${localGeneration} for "${participant}" has already completed`
      );
    }

    let active = this.activeBuild;
    if (!active || active.session.isTerminal) {
      active = this.createBuild();
    } else if (active.startedParticipants.has(participant)) {
      // The same child invalidated again before the pending logical build completed.
      // Supersede the incomplete generation rather than combining both outputs.
      const pendingParticipants = [...active.dirtyParticipants];
      active = this.createBuild();
      for (const pending of pendingParticipants) active.dirtyParticipants.add(pending);
    }

    this.activeBuild = active;
    active.dirtyParticipants.add(participant);
    active.startedParticipants.add(participant);
    this.localGenerations.set(participant, {
      localGeneration,
      logicalGeneration: active.logicalGeneration,
    });
  }

  async contribute(contribution: XPackBuildContribution): Promise<boolean> {
    const active = this.resolveBuild(contribution);
    const { session } = active;
    try {
      session.contribute({
        participant: contribution.participant,
        key: contribution.participant,
        assetsMap: contribution.assetsMap,
        data: {
          buildStats: contribution.buildStats,
          mfConfigs: contribution.mfConfigs,
          hooks: contribution.hooks,
          dependencyPaths: contribution.dependencyPaths,
        },
      });
      session.completeParticipant(contribution.participant);
      active.contributions.set(contribution.participant, contribution);
      active.dirtyParticipants.delete(contribution.participant);
      return await this.publishIfReady(active);
    } catch (error) {
      this.rememberFailedBuild(active);
      if (!session.isTerminal) {
        session.fail(contribution.participant, error);
      }
      throw error;
    }
  }

  /** Fail and release the shared generation when a child never reaches contribution. */
  failParticipant(participant: string, error: unknown): void {
    this.assertParticipant(participant);
    if (this.activeBuild?.session.status === 'failed') return;
    const active =
      !this.activeBuild || this.activeBuild.session.isTerminal
        ? this.createBuild()
        : this.activeBuild;
    active.dirtyParticipants.add(participant);
    this.rememberFailedBuild(active);
    active.session.fail(participant, error);
  }

  private createBuild(): ActiveXPackBuild {
    const logicalGeneration = this.nextLogicalGeneration++;
    const session = this.context.beginBuild({
      invocationId: 'xpack-multi-compiler',
      generation: logicalGeneration,
      // TAP artifact paths and hashes are descriptor-locked. Reject an adapter alias
      // here instead of normalizing/re-hashing it while the coordinated snapshot is
      // being assembled.
      strictAssetPaths: this.engine.env?.target === 'tap-app',
      participants: this.participants,
    });
    const active = {
      logicalGeneration,
      session,
      dirtyParticipants: new Set(this.pendingRecoveryParticipants),
      startedParticipants: new Set<string>(),
      contributions: new Map<string, XPackBuildContribution>(),
      invalidationKeys: new Set<string>(),
    };
    this.activeBuild = active;
    return active;
  }

  private resolveBuild(contribution: XPackBuildContribution): ActiveXPackBuild {
    this.assertParticipant(contribution.participant);
    if (contribution.generation !== undefined) {
      let localState = this.localGenerations.get(contribution.participant);
      if (!localState || localState.localGeneration !== contribution.generation) {
        this.beginParticipant(contribution.participant, contribution.generation);
        localState = this.localGenerations.get(contribution.participant);
      }
      const active = this.activeBuild;
      if (!active || localState?.logicalGeneration !== active.logicalGeneration) {
        throw xpackError(
          `Stale xpack generation ${contribution.generation} for "${contribution.participant}"`
        );
      }
      return active;
    }

    let active = this.activeBuild;
    if (
      !active ||
      active.session.isTerminal ||
      active.contributions.has(contribution.participant)
    ) {
      active = this.createBuild();
    }
    active.dirtyParticipants.add(contribution.participant);
    return active;
  }

  private async publishIfReady(active: ActiveXPackBuild): Promise<boolean> {
    if (active !== this.activeBuild || active.dirtyParticipants.size > 0) {
      return false;
    }

    for (const { name } of this.participants) {
      if (active.contributions.has(name)) continue;
      const previous = this.lastSuccessful.get(name);
      if (!previous) return false;
      active.session.contribute({
        participant: name,
        key: name,
        assetsMap: previous.assetsMap,
        data: {
          buildStats: previous.buildStats,
          mfConfigs: previous.mfConfigs,
          hooks: previous.hooks,
          dependencyPaths: previous.dependencyPaths,
        },
      });
      active.session.completeParticipant(name);
      active.contributions.set(name, previous);
    }

    if (!active.session.readiness.ready) return false;
    await active.session.publish();
    for (const contribution of active.session.seal().contributions) {
      if (!contribution.data) continue;
      this.lastSuccessful.set(contribution.participant, {
        participant: contribution.participant,
        assetsMap: contribution.assetsMap,
        buildStats: contribution.data.buildStats,
        mfConfigs: contribution.data.mfConfigs,
        hooks: contribution.data.hooks,
        dependencyPaths: contribution.data.dependencyPaths,
      });
    }
    this.pendingRecoveryParticipants.clear();
    return true;
  }

  private rememberFailedBuild(active: ActiveXPackBuild): void {
    const affected = new Set([
      ...active.dirtyParticipants,
      ...active.startedParticipants,
    ]);
    for (const participant of affected) {
      this.pendingRecoveryParticipants.add(participant);
      const state = this.localGenerations.get(participant);
      const rejectedGeneration = active.startedParticipants.has(participant)
        ? state?.localGeneration
        : (state?.localGeneration ?? -1) + 1;
      if (rejectedGeneration === undefined) continue;
      let rejected = this.rejectedLocalGenerations.get(participant);
      if (!rejected) {
        rejected = new Set();
        this.rejectedLocalGenerations.set(participant, rejected);
      }
      rejected.add(rejectedGeneration);
    }
  }

  private openInvalidationBatch(
    originParticipant: string,
    affectedParticipants: Iterable<string>,
    invalidationKey?: string
  ): void {
    let active = this.activeBuild;
    const affected = [...affectedParticipants];
    const joinsExistingInvalidation =
      !!active && !!invalidationKey && active.invalidationKeys.has(invalidationKey);
    if (!active || active.session.isTerminal) {
      active = this.createBuild();
    } else if (active.startedParticipants.has(originParticipant)) {
      // A second invalidation for a child already compiling supersedes that logical
      // generation. A later hook from a different affected child stays in this batch.
      active = this.createBuild();
    } else if (
      !joinsExistingInvalidation &&
      affected.some((participant) => active?.contributions.has(participant))
    ) {
      // A different path invalidated output already contributed to this generation.
      active = this.createBuild();
    }
    if (invalidationKey) active.invalidationKeys.add(invalidationKey);
    for (const participant of affected) {
      this.assertParticipant(participant);
      if (joinsExistingInvalidation && active.contributions.has(participant)) continue;
      active.dirtyParticipants.add(participant);
    }
    this.activeBuild = active;
  }

  private resolveAffectedParticipants(
    originParticipant: string,
    filename?: string | null
  ): Set<string> {
    const direct = new Set<string>([originParticipant]);
    if (!filename?.trim()) {
      return new Set(this.participantNames);
    }

    // Missing dependency metadata makes a negative match unsafe. This occurs only
    // before a complete baseline or with an unsupported compiler, so rebuild all.
    if (
      this.lastSuccessful.size !== this.participants.length ||
      [...this.participantNames].some(
        (participant) => !this.lastSuccessful.get(participant)?.dependencyPaths
      )
    ) {
      return new Set(this.participantNames);
    }

    const invalidatedPath = normalizedDependencyPath(filename);
    for (const participant of this.participantNames) {
      const dependencies = this.lastSuccessful.get(participant)?.dependencyPaths;
      if (dependencies && dependencyPathsInclude(dependencies, invalidatedPath)) {
        direct.add(participant);
      }
    }

    const affected = new Set(direct);
    const queue = [...direct];
    while (queue.length > 0) {
      const dependency = queue.shift();
      if (!dependency) continue;
      for (const dependent of this.dependents.get(dependency) ?? []) {
        if (affected.has(dependent)) continue;
        affected.add(dependent);
        queue.push(dependent);
      }
    }
    return affected;
  }

  private assertParticipant(participant: string): void {
    if (!this.participantNames.has(participant)) {
      throw xpackError(`Unknown coordinated xpack participant "${participant}"`);
    }
  }
}
