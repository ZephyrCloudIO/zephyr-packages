import { ZeErrors, ZephyrError } from 'zephyr-agent';
import type { ZephyrBuildTarget } from 'zephyr-edge-contract';

const MAX_LISTED_PATHS = 10;
const TYPESCRIPT_SOURCE = /\.(ts|tsx|mts|cts)$/i;
const TYPESCRIPT_DECLARATION = /\.d\.(ts|mts|cts)$/i;
const ROOT_LOCKFILES: readonly string[] = [
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  'bun.lock',
];
const TS_SYNC_BYTE = 0x47;
const TS_PACKET_SIZE = 188;
const WRANGLER_CONFIG = /^wrangler\.(toml|json|jsonc)$/i;

/** A selected file, with its content so the guard can tell video from source code. */
export interface GuardedFile {
  path: string;
  content: Buffer | string;
}

/**
 * MPEG transport stream (HLS segment): the sync byte 0x47 opens every 188 byte packet. A
 * TypeScript file starts with text, so byte 0 plus byte 188 (when the file is longer)
 * tells the two apart.
 */
function isMpegTransportStream(content: Buffer | string): boolean {
  const bytes = typeof content === 'string' ? Buffer.from(content, 'latin1') : content;
  if (bytes.length === 0 || bytes[0] !== TS_SYNC_BYTE) return false;
  return bytes.length <= TS_PACKET_SIZE || bytes[TS_PACKET_SIZE] === TS_SYNC_BYTE;
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function listPaths(paths: readonly string[]): string {
  const shown = paths.slice(0, MAX_LISTED_PATHS).join(', ');
  const rest = paths.length - MAX_LISTED_PATHS;
  return rest > 0 ? `${shown}, and ${rest} more` : shown;
}

function guardError(message: string): ZephyrError<'ERR_UNKNOWN'> {
  return new ZephyrError(ZeErrors.ERR_UNKNOWN, { message });
}

/**
 * Refuses an upload set that is not compiled output: TypeScript source files (an MPEG-TS
 * video segment with a `.ts` name is fine), or a folder that looks like a project root.
 * `tap-app` keeps its SDK-locked pass-through. Call it on the already selected paths
 * (after include, exclude and the denylist).
 */
export function assertCompiledOutput(
  selectedFiles: readonly GuardedFile[],
  target: ZephyrBuildTarget | undefined
): void {
  if (target === 'tap-app') return;
  const selectedPaths = selectedFiles.map((file) => file.path);

  const sources = selectedFiles
    .filter(
      ({ path, content }) =>
        TYPESCRIPT_SOURCE.test(path) &&
        !TYPESCRIPT_DECLARATION.test(path) &&
        !isMpegTransportStream(content)
    )
    .map((file) => file.path);
  if (sources.length > 0) {
    throw guardError(
      `Refusing to upload TypeScript source files: ${listPaths(sources)}. Upload compiled output only; build first or narrow include/exclude in zephyr.config.json.`
    );
  }

  const hasPackageJson = selectedPaths.includes('package.json');
  const projectMarkers = selectedPaths.filter(
    (path) => path === 'tsconfig.json' || path.startsWith('src/')
  );
  const lockfiles = selectedPaths.filter((path) => ROOT_LOCKFILES.includes(path));
  const signals = [...projectMarkers, ...lockfiles];
  if (hasPackageJson && signals.length > 0) {
    throw guardError(
      `The upload root looks like a project root, not build output (package.json together with ${listPaths(signals)}). Point the upload at the compiled output folder.`
    );
  }
}

/**
 * Refuses a folder that holds a Wrangler config when no zephyr.config.json is in effect.
 * Wrangler configs carry plain-text `vars` and sit next to `.dev.vars` secrets, so a
 * blind upload could expose them. Pass every walked path, before any filtering.
 */
export function assertNoUnconfiguredWorkerConfig(
  allWalkedPaths: readonly string[],
  hasConfig: boolean
): void {
  if (hasConfig) return;
  const found = allWalkedPaths.filter((path) => WRANGLER_CONFIG.test(basename(path)));
  if (found.length === 0) return;
  throw guardError(
    `Found ${listPaths(found)} but no zephyr.config.json. Wrangler configs can hold plain-text variables, so ze-cli will not upload this folder blindly. Add a zephyr.config.json with explicit include and exclude globs (see ze-cli --help). The --include and --exclude flags do not count as a config.`
  );
}
