import { execFile as node_execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CiIdentityProvider, CiTokenIdentity } from './types';
import { getEmails } from './utils';

const execFile = promisify(node_execFile);

const EAS_ISSUER = 'https://expo.dev';
const GIT_TIMEOUT_MS = 10_000;

/**
 * EAS Build exposes no email or verifiable identity token, only the Expo username of the
 * user that started the build (undefined for robot users). Emails come from the built
 * commit so cloud-io can resolve a Zephyr member. Without an email, the Expo actor is
 * reported as a bot so the CI token creator authorizes the deployment. A canonical
 * identity is never sent for the user path because Expo accounts cannot be linked in
 * Zephyr, and cloud-io does not fall back to emails for unlinked identities.
 *
 * ZE_USER_EMAIL is intentionally not read: ZE_CI_TOKEN is the only supported CI
 * credential, and the legacy ZE_SERVER_TOKEN/ZE_USER_EMAIL pair is being deprecated.
 */
export const easCiIdentityProvider: CiIdentityProvider = {
  provider: 'eas',
  detect: isEasBuild,
  infer: inferEasIdentity,
};

function isEasBuild(env: NodeJS.ProcessEnv): boolean {
  return env['EAS_BUILD'] === 'true';
}

async function inferEasIdentity(
  env: NodeJS.ProcessEnv
): Promise<CiTokenIdentity | undefined> {
  const username = env['EAS_BUILD_USERNAME']?.trim() || undefined;
  const emails = await readCommitEmails(env);

  if (emails.length > 0) {
    return {
      provider: 'eas',
      email: emails[0],
      emails,
      username,
      source: 'git',
    };
  }

  const providerSubject = username ?? env['EAS_BUILD_PROJECT_ID']?.trim();
  if (!providerSubject) {
    return undefined;
  }

  return {
    provider: 'eas',
    issuer: EAS_ISSUER,
    providerSubject,
    username,
    providerActorType: 'bot',
    source: 'env',
  };
}

async function readCommitEmails(env: NodeJS.ProcessEnv): Promise<string[]> {
  const commit = env['EAS_BUILD_GIT_COMMIT_HASH']?.trim() || 'HEAD';
  try {
    const { stdout } = await execFile(
      'git',
      ['show', '-s', '--format=%ae%n%ce', commit],
      {
        cwd: env['EAS_BUILD_WORKINGDIR']?.trim() || process.cwd(),
        timeout: GIT_TIMEOUT_MS,
      }
    );
    return getEmails(stdout.split('\n'));
  } catch {
    return [];
  }
}
