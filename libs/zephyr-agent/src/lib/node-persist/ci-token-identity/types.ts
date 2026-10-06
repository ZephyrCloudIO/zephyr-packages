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
}
