/** The descriptor at the root of every provider artifact. */
export const PROVIDER_DESCRIPTOR_FILE = 'mcp-provider.json';
/** The catalog file the descriptor points at, in M1. */
export const CATALOG_MANIFEST_FILE = 'catalog.json';
/** The single runtime module of a provider with tools. */
export const RUNTIME_ENTRY = 'tools/index.js';
/** The isolate protocol the runtime module speaks. */
export const RUNTIME_PROTOCOL = 1;
/** Pinned per package release; the Worker Loader compatibility date. */
export const DEFAULT_COMPATIBILITY_DATE = '2026-07-01';
/**
 * The earliest compatibility date the Zephyr MCP loads. It loads a provider only when the
 * date is within [this, the MCP's own compatibility date] and otherwise skips all of its
 * tools.
 */
export const MIN_COMPATIBILITY_DATE = '2025-11-17';
/** The only compatibility flags a catalog may ask for. */
export const RUNTIME_COMPATIBILITY_FLAGS = ['enable_request_signal'] as const;

/** Size and count limits from the contract. */
export const LIMITS = {
  /** Catalog.json, in bytes. */
  catalogBytes: 524_288,
  skills: 200,
  tools: 200,
  /** Files per skill, `SKILL.md` included (SEP-2640). */
  filesPerSkill: 512,
  /** Per skill file, in bytes. */
  skillFileBytes: 5 * 1024 * 1024,
  /** All of a skill's files together, in bytes (SEP-2640). */
  skillTotalBytes: 16 * 1024 * 1024,
  /** The runtime module, in bytes. */
  runtimeModuleBytes: 10 * 1024 * 1024,
  toolDescription: 2_048,
  providerVersion: 64,
  evalResults: 1_000,
  evalRunner: 128,
  /** Characters of an eval result's `evalId`. */
  evalId: 256,
} as const;

/** The top-level folders of a skill that are served next to `SKILL.md`. */
export const SERVED_SKILL_DIRS: readonly string[] = ['references', 'assets', 'scripts'];

/**
 * Canonical agent keys, matched from client identity strings by the Zephyr MCP. Pins and
 * eval results only accept these.
 */
export const AGENT_KEYS = [
  'claude-code',
  'claude',
  'codex',
  'cursor',
  'copilot',
  'gemini-cli',
  'opencode',
  'windsurf',
  'chatgpt',
  'default',
] as const;

export type AgentKey = (typeof AGENT_KEYS)[number];
