import { easCiIdentityProvider } from './ci-token-identity/eas';
import { gitHubCiIdentityProvider } from './ci-token-identity/github';
import { gitLabCiIdentityProvider } from './ci-token-identity/gitlab';
import type { CiIdentityProvider, CiTokenIdentity } from './ci-token-identity/types';

const ciIdentityProviders: CiIdentityProvider[] = [
  gitLabCiIdentityProvider,
  gitHubCiIdentityProvider,
  // Last, so `eas build --local` inside GitHub/GitLab CI keeps the stronger identity.
  easCiIdentityProvider,
];

export async function inferCiTokenIdentity(
  env: NodeJS.ProcessEnv = process.env
): Promise<CiTokenIdentity | undefined> {
  for (const provider of ciIdentityProviders) {
    if (!provider.detect(env)) {
      continue;
    }

    const identity = await provider.infer(env);
    if (identity) {
      return identity;
    }
  }

  return undefined;
}

export type { CiProvider, CiTokenIdentity } from './ci-token-identity/types';
