interface RuntimeGuardInput {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
}

export function shouldSkipZephyrUpload({
  argv = process.argv,
  env = process.env,
}: RuntimeGuardInput = {}): boolean {
  const lifecycleEvent = env['npm_lifecycle_event']?.toLowerCase();
  if (lifecycleEvent === 'postinstall') {
    return true;
  }

  const nuxtCommand =
    env['NUXT_COMMAND']?.toLowerCase() ?? env['nuxi_command']?.toLowerCase();
  if (nuxtCommand === 'prepare') {
    return true;
  }

  return argv.includes('prepare');
}
