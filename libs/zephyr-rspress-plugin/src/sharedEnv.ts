const globalEnvVars = new Set<string>();

export function trackEnvVar(key: string) {
  globalEnvVars.add(key);
}

export function getGlobalEnvVars() {
  return globalEnvVars;
}