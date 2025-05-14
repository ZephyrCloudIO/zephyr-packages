import { createHash } from 'node:crypto';
import { createZeEnvsFile, ZephyrEnvsGlobal } from 'zephyr-edge-contract';

const regexes = {
  importMetaEnv: {
    simple: /\bimport\.meta\.env\.(ZE_[a-zA-Z0-9_]+)/g,
    quoted: /\bimport\.meta\.env\[(['"`])(ZE_[a-zA-Z0-9_]+)\1\]/g,
  },
  processEnv: {
    simple: /\bprocess\.env\.(ZE_[a-zA-Z0-9_]+)/g,
    quoted: /\bprocess\.env\[(['"`])(ZE_[a-zA-Z0-9_]+)\1\]/g,
  },
} as const;

/**
 * A function used to find references to `ZE_*` envs in the code string and replace them
 * with `window[Symbol.for('ze_envs')].ZE_*`.
 *
 * @param code The source code to search for envs
 * @param variablesSet The mutable set to add all env names found in the code
 * @param kinds Which kind of env references to search for
 * @returns The replaced code
 */
export function findAndReplaceVariables(
  code: string,
  variablesSet: Set<string>,
  kinds: (keyof typeof regexes)[]
): string {
  for (const kind of kinds) {
    const { simple, quoted } = regexes[kind];

    quoted.lastIndex = 0;
    simple.lastIndex = 0;

    // Can use newer syntax (?) because it runs before bundler's transformations
    code = code
      .replace(simple, (_, name) => {
        variablesSet.add(name);
        return `${ZephyrEnvsGlobal}?.${name}`;
      })
      .replace(quoted, (_, quote, name) => {
        variablesSet.add(name);
        return `${ZephyrEnvsGlobal}?.[${quote}${name}${quote}]`;
      });
  }

  return code;
}

/** Returns a temporary ze-envs.js file contents with all used envs in the related build. */
export function createTemporaryVariablesFile(variablesSet: Set<string>) {
  const envs: Record<string, string> = {};

  // Ensures either a local value or a process.env value is used
  for (const name of variablesSet) {
    envs[name] ??= process.env[name] ?? name;
  }

  const source = createZeEnvsFile(envs);

  return {
    source,
    hash: createHash('sha256').update(source).digest('base64url').slice(0, 8),
  };
}
