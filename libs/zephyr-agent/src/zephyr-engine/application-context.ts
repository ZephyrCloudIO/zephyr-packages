import {
  BuildSession,
  BuildSessionRollbackError,
  BuildSessionStateError,
} from './build-session';
import type {
  ApplicationContextOptions,
  ApplicationContextRegistryLocator,
  BeginBuildOptions,
} from './zephyr-engine.types';

function buildDefinitionKey(options: BeginBuildOptions): string {
  const participants = options.participants
    .map((participant) => ({
      name: participant.name,
      role: participant.role ?? participant.name,
      required: participant.required ?? true,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const postprocessors = [...(options.postprocessors ?? [])].sort();
  return JSON.stringify({ participants, postprocessors });
}

/** Load-once application state which owns successive logical build generations. */
export class ApplicationContext<TData = unknown, TResult = void> {
  readonly applicationUid: string;

  private readonly options: ApplicationContextOptions<TData, TResult>;
  private latestGeneration = -1;
  private activeSession: BuildSession<TData, TResult> | null = null;
  private activeDefinitionKey: string | null = null;

  constructor(options: ApplicationContextOptions<TData, TResult>) {
    if (!options.applicationUid.trim()) {
      throw new BuildSessionStateError('Application UID must not be empty');
    }
    this.applicationUid = options.applicationUid;
    this.options = options;
  }

  get currentBuild(): BuildSession<TData, TResult> | null {
    return this.activeSession;
  }

  beginBuild(options: BeginBuildOptions): BuildSession<TData, TResult> {
    const definitionKey = buildDefinitionKey(options);
    const generation = options.generation ?? this.latestGeneration + 1;
    if (!Number.isSafeInteger(generation) || generation < 0) {
      throw new BuildSessionStateError(
        `Build generation must be a non-negative safe integer, received ${generation}`
      );
    }
    const invocationId = options.invocationId ?? `invocation-${generation}`;
    if (!invocationId.trim()) {
      throw new BuildSessionStateError('Build invocation ID must not be empty');
    }

    const active = this.activeSession;
    if (active?.failure instanceof BuildSessionRollbackError) {
      throw active.failure;
    }
    if (
      active &&
      active.identity.generation === generation &&
      active.identity.invocationId === invocationId
    ) {
      if (definitionKey !== this.activeDefinitionKey) {
        throw new BuildSessionStateError(
          'Build participants or postprocessors differ for the same invocation generation'
        );
      }
      return active;
    }

    if (generation <= this.latestGeneration) {
      throw new BuildSessionStateError(
        `Build generation ${generation} is stale; latest generation is ${this.latestGeneration}`
      );
    }

    if (active && !active.isTerminal) {
      active.abort(`Superseded by build generation ${generation}`);
    }

    const session = new BuildSession<TData, TResult>(
      {
        applicationUid: this.applicationUid,
        invocationId,
        generation,
      },
      options.participants,
      options.postprocessors ?? [],
      {
        prepare: this.options.prepare,
        publish: this.options.publish,
        finish: this.options.finish,
        onFailure: this.options.onFailure,
      }
    );
    this.latestGeneration = generation;
    this.activeSession = session;
    this.activeDefinitionKey = definitionKey;
    return session;
  }

  abortCurrent(reason?: unknown): void {
    const active = this.activeSession;
    if (active?.failure instanceof BuildSessionRollbackError) {
      throw active.failure;
    }
    active?.abort(reason);
  }
}

interface RegistryEntry<TData, TResult> {
  context: ApplicationContext<TData, TResult>;
  aliases: Set<string>;
}

/**
 * Caller-owned rendezvous registry. Wrappers can share this object between independently
 * created plugins, associate an early contextKey with a later application identity, and
 * explicitly dispose all aliases when the compiler closes.
 */
export class ApplicationContextRegistry<TData = unknown, TResult = void> {
  private readonly entries = new Map<string, RegistryEntry<TData, TResult>>();
  private readonly pending = new Map<
    string,
    Promise<ApplicationContext<TData, TResult>>
  >();
  private readonly disposedPending = new WeakSet<
    Promise<ApplicationContext<TData, TResult>>
  >();

  getOrCreate(
    locator: ApplicationContextRegistryLocator,
    create: () => ApplicationContext<TData, TResult>
  ): ApplicationContext<TData, TResult> {
    const aliases = this.createAliases(locator);
    const existingEntries = new Set(
      aliases
        .map((alias) => this.entries.get(alias))
        .filter((entry): entry is RegistryEntry<TData, TResult> => !!entry)
    );
    if (existingEntries.size > 1) {
      throw new BuildSessionStateError(
        'Application context aliases resolve to different registered contexts'
      );
    }

    let entry = existingEntries.values().next().value;
    if (!entry) {
      const context = create();
      entry = [...new Set(this.entries.values())].find(
        (candidate) => candidate.context === context
      ) ?? {
        context,
        aliases: new Set<string>(),
      };
    }
    if (
      locator.applicationUid &&
      entry.context.applicationUid !== locator.applicationUid
    ) {
      throw new BuildSessionStateError(
        `Application context UID mismatch: expected ${locator.applicationUid}, ` +
          `received ${entry.context.applicationUid}`
      );
    }

    for (const alias of aliases) {
      const owner = this.entries.get(alias);
      if (owner && owner !== entry) {
        throw new BuildSessionStateError(
          `Application context alias "${alias}" is already registered`
        );
      }
      entry.aliases.add(alias);
      this.entries.set(alias, entry);
    }
    return entry.context;
  }

  /**
   * Single-flight async variant for wrappers which must initialize ZephyrEngine before
   * the application UID is available. Concurrent callers using the same early key share
   * one factory promise (and therefore one engine/build ID allocation).
   */
  async getOrCreateAsync(
    locator: ApplicationContextRegistryLocator,
    create: () => Promise<ApplicationContext<TData, TResult>>
  ): Promise<ApplicationContext<TData, TResult>> {
    const aliases = this.createAliases(locator);
    const existing = this.get(locator);
    if (existing) {
      return existing;
    }

    const pendingContexts = new Set(
      aliases
        .map((alias) => this.pending.get(alias))
        .filter(
          (context): context is Promise<ApplicationContext<TData, TResult>> => !!context
        )
    );
    if (pendingContexts.size > 1) {
      throw new BuildSessionStateError(
        'Application context aliases have different pending initializations'
      );
    }

    let pendingContext = pendingContexts.values().next().value;
    if (!pendingContext) {
      pendingContext = Promise.resolve().then(create);
    }
    for (const alias of aliases) {
      const owner = this.pending.get(alias);
      if (owner && owner !== pendingContext) {
        throw new BuildSessionStateError(
          `Application context alias "${alias}" is already initializing`
        );
      }
      this.pending.set(alias, pendingContext);
    }

    try {
      const context = await pendingContext;
      if (this.disposedPending.has(pendingContext)) {
        context.abortCurrent('Context disposed during initialization');
        throw new BuildSessionStateError(
          'Application context was disposed during initialization'
        );
      }
      this.clearPendingAliases(pendingContext);
      return this.getOrCreate(locator, () => context);
    } catch (error: unknown) {
      this.clearPendingAliases(pendingContext);
      throw error;
    }
  }

  get(
    locator: ApplicationContextRegistryLocator
  ): ApplicationContext<TData, TResult> | null {
    const entries = new Set(
      this.createAliases(locator)
        .map((alias) => this.entries.get(alias))
        .filter((entry): entry is RegistryEntry<TData, TResult> => !!entry)
    );
    if (entries.size > 1) {
      throw new BuildSessionStateError(
        'Application context aliases resolve to different registered contexts'
      );
    }
    return entries.values().next().value?.context ?? null;
  }

  /** Associate additional identity aliases with a context previously created by key. */
  associate(
    existing: ApplicationContextRegistryLocator,
    aliases: ApplicationContextRegistryLocator
  ): ApplicationContext<TData, TResult> {
    const context = this.get(existing);
    if (!context) {
      throw new BuildSessionStateError('Cannot associate an unknown application context');
    }
    const aliasedContext = this.get(aliases);
    if (aliasedContext && aliasedContext !== context) {
      throw new BuildSessionStateError(
        'Cannot associate aliases owned by a different application context'
      );
    }
    return this.getOrCreate(aliases, () => context);
  }

  dispose(
    locator: ApplicationContextRegistryLocator,
    reason = 'Context disposed'
  ): boolean {
    const aliases = this.createAliases(locator);
    const entry = aliases
      .map((alias) => this.entries.get(alias))
      .find((candidate): candidate is RegistryEntry<TData, TResult> => !!candidate);
    if (!entry) {
      const pendingContext = aliases
        .map((alias) => this.pending.get(alias))
        .find(
          (context): context is Promise<ApplicationContext<TData, TResult>> => !!context
        );
      if (!pendingContext) {
        return false;
      }
      this.disposedPending.add(pendingContext);
      this.clearPendingAliases(pendingContext);
      return true;
    }

    if (entry.context.currentBuild?.status !== 'publishing') {
      entry.context.abortCurrent(reason);
    }
    for (const alias of entry.aliases) {
      this.entries.delete(alias);
    }
    entry.aliases.clear();
    return true;
  }

  clear(reason = 'Registry cleared'): void {
    for (const pendingContext of new Set(this.pending.values())) {
      this.disposedPending.add(pendingContext);
    }
    this.pending.clear();
    const uniqueEntries = new Set(this.entries.values());
    for (const entry of uniqueEntries) {
      if (entry.context.currentBuild?.status !== 'publishing') {
        entry.context.abortCurrent(reason);
      }
      entry.aliases.clear();
    }
    this.entries.clear();
  }

  private clearPendingAliases(
    pendingContext: Promise<ApplicationContext<TData, TResult>>
  ): void {
    for (const [alias, owner] of this.pending) {
      if (owner === pendingContext) {
        this.pending.delete(alias);
      }
    }
  }

  private createAliases(locator: ApplicationContextRegistryLocator): string[] {
    const aliases: string[] = [];
    if (locator.contextKey?.trim()) {
      aliases.push(`context:${locator.contextKey.trim()}`);
    }
    if (locator.applicationUid || locator.invocationId) {
      if (!locator.applicationUid?.trim() || !locator.invocationId?.trim()) {
        throw new BuildSessionStateError(
          'applicationUid and invocationId must be supplied together'
        );
      }
      aliases.push(
        `identity:${JSON.stringify([locator.applicationUid, locator.invocationId])}`
      );
    }
    if (aliases.length === 0) {
      throw new BuildSessionStateError(
        'An application/invocation identity or contextKey is required'
      );
    }
    return aliases;
  }
}
