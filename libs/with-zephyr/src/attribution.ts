import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

export const GIT_AI_SETUP_URL = 'https://usegitai.com/docs/get-started';
export interface AttributionSetupOptions {
  attribution?: boolean;
  attributionAgents?: string[];
  attributionStorage?: string;
  gitAiPath?: string;
  dryRun?: boolean;
}
type JsonObject = Record<string, unknown>;
function jsonObject(filename: string): JsonObject {
  if (!existsSync(filename)) return {};
  const value: unknown = JSON.parse(readFileSync(filename, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`Expected an object in ${filename}`);
  return value as JsonObject;
}
function writeJson(filename: string, value: unknown) {
  mkdirSync(dirname(filename), { recursive: true });
  writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);
}
/** Project-local configuration; never edits user-global hooks or trust settings. */
export function configureAttribution(
  directory: string,
  options: AttributionSetupOptions
) {
  const agents = [...new Set(options.attributionAgents ?? [])];
  if (
    options.attributionStorage !== undefined &&
    !['local', 'remote'].includes(options.attributionStorage)
  )
    throw new Error('Attribution storage must be local or remote');
  if (agents.some((agent) => !['codex', 'claude', 'grok'].includes(agent))) {
    throw new Error(
      'Supported attribution agents: codex, claude, grok. See the Git AI link for other integrations.'
    );
  }
  const binary = options.gitAiPath ?? 'git-ai';
  if (/['"\r\n]/.test(binary))
    throw new Error('Git AI path cannot contain quotes or newlines');
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: resolve(directory),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  const configPath = join(root, '.zephyr', 'attribution.json');
  const config = jsonObject(configPath);
  if (
    Object.keys(config).some(
      (key) =>
        ![
          'schemaVersion',
          'enabled',
          'storage',
          'content',
          'repositoryId',
          'gitAiPath',
          'exclude',
        ].includes(key)
    ) ||
    (config['storage'] !== undefined &&
      (typeof config['storage'] !== 'string' ||
        !['local', 'remote'].includes(config['storage']))) ||
    (config['content'] !== undefined &&
      (!config['content'] ||
        typeof config['content'] !== 'object' ||
        Array.isArray(config['content']) ||
        Object.entries(config['content'] as JsonObject).some(
          ([key, flag]) => !['patch', 'lines'].includes(key) || typeof flag !== 'boolean'
        )))
  )
    throw new Error(
      'Invalid attribution preferences; do not store credentials, endpoints, or account tier in repo configuration'
    );
  if (config['schemaVersion'] !== undefined && config['schemaVersion'] !== 1)
    throw new Error('Unsupported attribution configuration');
  const changes: [string, JsonObject][] = [
    [
      configPath,
      {
        ...config,
        schemaVersion: 1,
        enabled: true,
        storage: options.attributionStorage ?? config['storage'] ?? 'local',
        ...(options.gitAiPath ? { gitAiPath: binary } : {}),
      },
    ],
  ];
  const metadataCommand =
    'node "$(git rev-parse --show-toplevel)/.zephyr/attribution-hook.cjs"';
  for (const agent of agents) {
    const filename = join(
      root,
      agent === 'codex'
        ? '.codex/hooks.json'
        : agent === 'grok'
          ? '.grok/hooks/zephyr-attribution.json'
          : '.claude/settings.json'
    );
    const document = jsonObject(filename);
    const hooksValue = document['hooks'] ?? {};
    if (
      typeof hooksValue !== 'object' ||
      hooksValue === null ||
      Array.isArray(hooksValue)
    )
      throw new Error(`Invalid hooks in ${filename}`);
    const hooks: JsonObject = { ...(hooksValue as JsonObject) };
    // JSON config contains a shell command. POSIX single quotes prevent expansions.
    const command = `'${binary}' checkpoint ${agent} --hook-input stdin`;
    for (const event of agent === 'grok' ? [] : ['PreToolUse', 'PostToolUse']) {
      const existing = hooks[event] ?? [];
      if (!Array.isArray(existing))
        throw new Error(`Expected a hooks array for ${event} in ${filename}`);
      const present = existing.some((entry) =>
        entry?.hooks?.some((hook: { command?: string }) => hook.command === command)
      );
      hooks[event] = present
        ? existing
        : [
            ...existing,
            {
              matcher: 'Edit|Write|Bash',
              hooks: [{ type: 'command', command, timeout: 10 }],
            },
          ];
    }
    if (agent === 'codex' || agent === 'grok') {
      for (const event of [
        'UserPromptSubmit',
        'PreToolUse',
        'PostToolUse',
        'Stop',
        ...(agent === 'grok' ? ['StopCancelled', 'StopFailure'] : []),
      ]) {
        const existing = hooks[event] ?? [];
        if (!Array.isArray(existing)) throw new Error(`Invalid ${event} hooks`);
        if (
          !existing.some((entry) =>
            entry?.hooks?.some(
              (hook: { command?: string }) => hook.command === metadataCommand
            )
          )
        ) {
          hooks[event] = [
            ...existing,
            {
              ...(event.includes('ToolUse')
                ? {
                    matcher:
                      agent === 'grok'
                        ? 'Edit|Write|Bash|apply_patch|write|write_file|edit_file|search_replace|run_terminal_command'
                        : 'Edit|Write|Bash',
                  }
                : {}),
              hooks: [{ type: 'command', command: metadataCommand, timeout: 10 }],
            },
          ];
        }
      }
    }
    changes.push([filename, { ...document, hooks }]);
  }
  if (!options.dryRun) {
    const collector = agents.some((agent) => ['codex', 'grok'].includes(agent))
      ? readFileSync(new URL('../hooks/codex.cjs', import.meta.url), 'utf8')
      : undefined;
    for (const [filename, value] of changes) writeJson(filename, value);
    if (collector) writeFileSync(join(root, '.zephyr/attribution-hook.cjs'), collector);
  }
  let installed = false;
  try {
    installed = /^(?:git-ai version )?1\.7\./.test(
      execFileSync(binary, ['--version'], {
        encoding: 'utf8',
        timeout: 3000,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    );
  } catch {
    /* link lets the user install or choose a fork */
  }
  return { root, files: changes.map(([filename]) => filename), agents, installed };
}

/** Interactive consent is separate from ordinary SDK installation. */
export async function offerAttribution(
  directory: string,
  options: AttributionSetupOptions
) {
  if (options.attribution === false || options.dryRun || process.exitCode) return;
  console.log(
    `\nChange Attribution can record human and AI contributions, including uncommitted source changes.`
  );
  console.log(`Git AI installation and agent integrations: ${GIT_AI_SETUP_URL}`);
  console.log(
    'Local mode keeps all attribution in your private Git directory. Remote mode uploads evidence linked to the build: free accounts include patches and changed-line text; paid/BYOC can opt into either. Credentials and account tier are never stored in repository configuration. Prompt text is not included.'
  );
  let enabled: boolean | undefined = options.attribution;
  let agents = options.attributionAgents;
  let storage = options.attributionStorage;
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  let input: ReturnType<typeof createInterface> | undefined;
  try {
    if (interactive && enabled === undefined) {
      input = createInterface({ input: process.stdin, output: process.stdout });
      enabled = /^y(?:es)?$/i.test(
        (await input.question('Enable Change Attribution? [y/N] ')).trim()
      );
    }
    if (!enabled) {
      console.log('To enable later: with-zephyr . --attribution');
      return;
    }
    if (interactive && storage === undefined) {
      input ??= createInterface({ input: process.stdin, output: process.stdout });
      storage =
        (
          await input.question(
            'Attribution storage: local or remote? [keep current, default local]: '
          )
        ).trim() || undefined;
    }
    if (interactive && agents === undefined) {
      input ??= createInterface({ input: process.stdin, output: process.stdout });
      const answer = (
        await input.question(
          'Install Agent Integrations? Enter codex, claude, grok, or leave blank to skip: '
        )
      ).trim();
      agents = answer ? answer.split(/[,\s]+/) : [];
    }
    const result = configureAttribution(directory, {
      ...options,
      attributionAgents: agents,
      attributionStorage: storage,
    });
    console.log(`Change Attribution enabled in ${result.root}.`);
    if (!result.installed)
      console.log(`Install Git AI 1.7.x (tested with 1.7.5): ${GIT_AI_SETUP_URL}`);
    if (result.agents.includes('codex'))
      console.log(
        'In Codex, review and enable the project hooks with /hooks, then restart the session.'
      );
    if (result.agents.includes('claude'))
      console.log('In Claude Code, review the project hooks and restart the session.');
    if (result.agents.includes('grok'))
      console.log(
        'In Grok, review and trust the project hooks with /hooks-trust, then restart the session. T3 runs Grok through this same native integration.'
      );
    console.log(
      'Missing integration evidence is labeled unknown. Attribution starts after the hooks are enabled.'
    );
  } finally {
    input?.close();
  }
}
