function replacer(str: string): string {
  return str.replace(/[^a-zA-Z0-9-_]/gi, '_');
  // return str.replace(/\W/gi, '_');
}

export function createApplicationUID(options: { org: string; project: string; name: string }): string {
  const git_org = replacer(options.org);
  const git_repo = replacer(options.project);
  const app_name = replacer(options.name);
  return [app_name, git_repo, git_org].join('.').toLowerCase();
}
