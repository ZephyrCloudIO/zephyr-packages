import { easCiIdentityProvider } from './ci-token-identity/eas';
import { gitHubCiIdentityProvider } from './ci-token-identity/github';
import { gitLabCiIdentityProvider } from './ci-token-identity/gitlab';
import type {
  CiIdentityProvider,
  CiProvider,
  CiTokenIdentity,
} from './ci-token-identity/types';

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

/**
 * Reads the signed ID token for the CI job from the adapter that produced the identity.
 * Returns `undefined` when the provider issues none or the pipeline did not ask for one.
 *
 * The result is a credential. Use it only to build the CI token exchange request body. Do
 * not log it, store it, or add it to a {@link CiTokenIdentity}.
 */
export function readCiIdToken(
  provider: CiProvider,
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  return ciIdentityProviders
    .find((candidate) => candidate.provider === provider)
    ?.readIdToken?.(env);
}

export type { CiProvider, CiTokenIdentity } from './ci-token-identity/types';
