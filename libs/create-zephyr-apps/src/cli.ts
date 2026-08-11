import { parseArgs } from 'node:util';
import {
  DEFAULT_WEB_TEMPLATE,
  getTemplate,
  type ProjectType,
  ProjectTypes,
  TemplateRepositories,
  Templates,
} from './templates.js';

export const PackageManagers = ['pnpm', 'npm', 'yarn', 'bun'] as const;
export type PackageManager = (typeof PackageManagers)[number];

export interface CliOptions {
  directory?: string;
  template?: string;
  projectType?: ProjectType;
  packageManager?: PackageManager;
  initializeGit?: boolean;
  install: boolean;
  build: boolean;
  json: boolean;
  yes: boolean;
  templateRevision?: string;
  listTemplates: boolean;
  help: boolean;
  version: boolean;
}

export interface ResolvedCliOptions {
  directory: string;
  template?: string;
  projectType: ProjectType;
  packageManager?: PackageManager;
  initializeGit: boolean;
  install: boolean;
  build: boolean;
  json: boolean;
  templateRevision: string;
}

export interface PromptAdapter {
  directory(): Promise<string | undefined>;
  projectType(): Promise<ProjectType | undefined>;
  template(): Promise<string | undefined>;
  initializeGit(): Promise<boolean | undefined>;
}

export interface ResolveCliOptionsContext {
  interactive: boolean;
  prompts?: PromptAdapter;
}

export interface TerminalContext {
  inputIsTTY: boolean | undefined;
  outputIsTTY: boolean | undefined;
}

export class OperationCancelled extends Error {
  constructor() {
    super('Operation cancelled.');
    this.name = 'OperationCancelled';
  }
}

export const NON_INTERACTIVE_EXAMPLE_ARGS = [
  './apps/example',
  '--template',
  'react-rsbuild',
  '--package-manager',
  'pnpm',
  '--no-git',
  '--install',
  '--build',
  '--json',
] as const;

export const NON_INTERACTIVE_EXAMPLE = `create-zephyr-apps ${NON_INTERACTIVE_EXAMPLE_ARGS.join(
  ' '
)}`;

export const HELP_TEXT = `
Usage: create-zephyr-apps [directory] [options]

Create a Zephyr application from a version-pinned template.

Options:
  --directory, -d <path>           Project directory (alternative to positional)
  --template, -t <id>              Web template ID (default: ${DEFAULT_WEB_TEMPLATE})
  --project-type <type>            web or react-native (default: web)
  --package-manager <manager>      pnpm, npm, yarn, or bun
  --template-revision <commit>     Override the pinned template with a full commit SHA
  --git                            Initialize Git and create an initial commit
  --no-git                         Do not initialize Git
  --install                        Install dependencies
  --build                          Install dependencies and run the build script
  --json                           Emit one machine-readable JSON result
  --yes, -y                        Use deterministic defaults without prompting
  --list-templates                 List available web template IDs
  --version, -v                    Print the CLI version
  --help, -h                       Show this help

Example:
  ${NON_INTERACTIVE_EXAMPLE}
`.trim();

export function parseCliArgs(args: string[]): CliOptions {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      directory: { type: 'string', short: 'd' },
      template: { type: 'string', short: 't' },
      'project-type': { type: 'string' },
      'package-manager': { type: 'string' },
      'template-revision': { type: 'string' },
      git: { type: 'boolean' },
      'no-git': { type: 'boolean' },
      install: { type: 'boolean' },
      build: { type: 'boolean' },
      json: { type: 'boolean' },
      yes: { type: 'boolean', short: 'y' },
      'list-templates': { type: 'boolean' },
      version: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (parsed.positionals.length > 1) {
    throw new Error('Only one positional project directory is supported.');
  }

  const positionalDirectory = parsed.positionals[0];
  const flagDirectory = parsed.values.directory;
  if (positionalDirectory && flagDirectory) {
    throw new Error(
      'Provide the project directory either positionally or with --directory, not both.'
    );
  }

  if (parsed.values.git && parsed.values['no-git']) {
    throw new Error('--git and --no-git cannot be used together.');
  }

  const projectType = parsed.values['project-type'];
  if (
    projectType !== undefined &&
    !ProjectTypes.some((candidate) => candidate.value === projectType)
  ) {
    throw new Error(
      `Unsupported project type "${projectType}". Expected web or react-native.`
    );
  }

  const packageManager = parsed.values['package-manager'];
  if (
    packageManager !== undefined &&
    !PackageManagers.includes(packageManager as PackageManager)
  ) {
    throw new Error(
      `Unsupported package manager "${packageManager}". Expected ${PackageManagers.join(
        ', '
      )}.`
    );
  }

  const template = parsed.values.template;
  if (template !== undefined && !getTemplate(template)) {
    throw new Error(
      `Unknown template "${template}". Available templates: ${Templates.map(
        ({ name }) => name
      ).join(', ')}.`
    );
  }

  if (projectType === 'react-native' && template !== undefined) {
    throw new Error('--template is only supported for web projects.');
  }

  const templateRevision = parsed.values['template-revision'];
  if (templateRevision !== undefined && !/^[a-f\d]{40}$/iu.test(templateRevision)) {
    throw new Error('--template-revision must be a full 40-character commit SHA.');
  }

  return {
    directory: flagDirectory ?? positionalDirectory,
    template,
    projectType: projectType as ProjectType | undefined,
    packageManager: packageManager as PackageManager | undefined,
    initializeGit: parsed.values.git ? true : parsed.values['no-git'] ? false : undefined,
    install: parsed.values.install ?? false,
    build: parsed.values.build ?? false,
    json: parsed.values.json ?? false,
    yes: parsed.values.yes ?? false,
    templateRevision,
    listTemplates: parsed.values['list-templates'] ?? false,
    help: parsed.values.help ?? false,
    version: parsed.values.version ?? false,
  };
}

export function shouldUseInteractiveMode(
  options: CliOptions,
  terminal: TerminalContext
): boolean {
  return (
    options.directory === undefined &&
    !options.yes &&
    !options.json &&
    Boolean(terminal.inputIsTTY && terminal.outputIsTTY)
  );
}

export async function resolveCliOptions(
  options: CliOptions,
  context: ResolveCliOptionsContext
): Promise<ResolvedCliOptions> {
  const prompts = context.prompts;
  let directory = options.directory;
  if (directory === undefined && context.interactive && prompts) {
    directory = await prompts.directory();
    if (directory === undefined) {
      throw new OperationCancelled();
    }
  }

  if (!directory?.trim()) {
    throw new Error(
      'A project directory is required in non-interactive mode. Pass it positionally or with --directory.'
    );
  }

  let projectType = options.projectType ?? (options.template ? 'web' : undefined);
  if (projectType === undefined && context.interactive && prompts) {
    projectType = await prompts.projectType();
    if (projectType === undefined) {
      throw new OperationCancelled();
    }
  }
  projectType ??= 'web';

  let template = projectType === 'web' ? options.template : undefined;
  if (projectType === 'web' && template === undefined && context.interactive && prompts) {
    template = await prompts.template();
    if (template === undefined) {
      throw new OperationCancelled();
    }
  }
  template ??= projectType === 'web' ? DEFAULT_WEB_TEMPLATE : undefined;

  let initializeGit = options.initializeGit;
  if (initializeGit === undefined && context.interactive && prompts) {
    initializeGit = await prompts.initializeGit();
    if (initializeGit === undefined) {
      throw new OperationCancelled();
    }
  }
  initializeGit ??= false;

  const repository = TemplateRepositories[projectType];

  return {
    directory,
    template,
    projectType,
    packageManager: options.packageManager,
    initializeGit,
    install: options.install || options.build,
    build: options.build,
    json: options.json,
    templateRevision: options.templateRevision ?? repository.revision,
  };
}

export function listTemplatesJson(): string {
  return JSON.stringify(
    {
      default: DEFAULT_WEB_TEMPLATE,
      revision: TemplateRepositories.web.revision,
      templates: Templates,
    },
    null,
    2
  );
}
