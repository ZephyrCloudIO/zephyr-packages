import type { ZeGitInfo } from './ze-util-get-git-info';
import { ze_log } from '../logging';

let cachedGitInfo: ZeGitInfo | null = null;
let gitInfoPromise: Promise<ZeGitInfo> | null = null;

/**
 * Cache for git information to avoid prompting users multiple times during the same
 * process.
 */
export function getCachedGitInfo(): ZeGitInfo | null {
  return cachedGitInfo;
}

/**
 * Sets the cached git info. This should be called after successfully gathering git
 * information.
 */
export function setCachedGitInfo(gitInfo: ZeGitInfo): void {
  cachedGitInfo = gitInfo;
  ze_log.git('Git info cached for reuse');
}

/**
 * Clears the cached git info. Useful for testing or when you need to force re-gathering
 * of git information.
 */
export function clearGitInfoCache(): void {
  cachedGitInfo = null;
  gitInfoPromise = null;
  ze_log.git('Git info cache cleared');
}

/**
 * Gets or sets the promise for git info gathering. This ensures that multiple concurrent
 * calls to getGitInfo will wait for the same promise instead of prompting multiple
 * times.
 */
export function getGitInfoPromise(): Promise<ZeGitInfo> | null {
  return gitInfoPromise;
}

export function setGitInfoPromise(promise: Promise<ZeGitInfo> | null): void {
  gitInfoPromise = promise;
}
