export type CiProvider = 'gitlab' | 'github';

export interface CiTokenIdentity {
  provider: CiProvider;
  email?: string;
  emails?: string[];
  issuer?: string;
  providerSubject?: string;
  username?: string;
  source: 'jwt' | 'api' | 'env' | 'event' | 'noreply';
}

export interface CiIdentityProvider {
  provider: CiProvider;
  detect(env: NodeJS.ProcessEnv): boolean;
  infer(env: NodeJS.ProcessEnv): Promise<CiTokenIdentity | undefined>;
}
