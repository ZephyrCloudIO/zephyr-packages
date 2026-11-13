export type CiProvider = 'gitlab' | 'github' | 'eas';

export interface CiTokenIdentity {
  provider: CiProvider;
  email?: string;
  emails?: string[];
  issuer?: string;
  providerSubject?: string;
  username?: string;
  providerActorType?: 'user' | 'bot';
  source: 'jwt' | 'api' | 'env' | 'event' | 'noreply' | 'git';
}

export interface CiIdentityProvider {
  provider: CiProvider;
  detect(env: NodeJS.ProcessEnv): boolean;
  infer(env: NodeJS.ProcessEnv): Promise<CiTokenIdentity | undefined>;
  /**
   * Reads the signed ID token the CI provider issued for this job, if the pipeline asked
   * for one. It lets the server check the reported identity against the provider's public
   * keys.
   *
   * The token is a credential, so it is not a field of {@link CiTokenIdentity}. The
   * identity is logged, shown in errors and hashed into the access-token cache key. The
   * token must reach none of those places. It is read only when the exchange request body
   * is built.
   */
  readIdToken?(env: NodeJS.ProcessEnv): string | undefined;
}
