import {
  createVariablesRecord,
  isSuccessTuple,
  PromiseTuple,
  ZephyrRuntimeConstants,
} from 'zephyr-edge-contract';
import { resolveApplicationVariables } from '../edge-requests/application-variables';
import { ZephyrError } from '../errors';
import { logFn } from '../logging/ze-log-event';

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
 * @param usedEnvNames The mutable set to add all env names found in the code
 * @param kinds Which kind of env references to search for
 * @returns The replaced code
 */
export function findAndReplaceVariables(
  code: string,
  application_uid: string,
  usedEnvNames: Set<string>,
  kinds: (keyof typeof regexes)[]
): string {
  const { globalObject } = ZephyrRuntimeConstants;

  for (const kind of kinds) {
    const { simple, quoted } = regexes[kind];

    // /g regexes are stateful, so we need to reset them
    quoted.lastIndex = 0;
    simple.lastIndex = 0;

    // Code can use chain operator because transformation happens after this
    code = code
      .replace(simple, (_, name) => {
        usedEnvNames.add(name);
        return `${globalObject}?.["${application_uid}"]?.${name}`;
      })
      .replace(quoted, (_, quote, name) => {
        usedEnvNames.add(name);
        return `${globalObject}?.["${application_uid}"]?.[${quote}${name}${quote}]`;
      });
  }

  return code;
}

/** Returns a temporary ze-envs.js file contents with all used envs in the related build. */
export async function createLocalVariablesRecord(
  usedEnvNames: ReadonlySet<string>,
  application_uid: string,
  remotes: string[],
  processEnv: Record<string, string | undefined>
) {
  const { missing, variables } = await createVariablesRecord({
    application_uid,
    remotes,
    processEnv,
    usedEnvNames,
    async requestMissingVariables(names, remotes, applyTo) {
      const result = await PromiseTuple(
        resolveApplicationVariables(application_uid, { names, remotes })
      );

      if (!isSuccessTuple(result)) {
        logFn('error', ZephyrError.format(result[0]));
        return;
      }

      let totalEnvs = 0;

      for (const appVar of result[1]) {
        for (const { name, value } of appVar.variables) {
          applyTo[appVar.application_uid][name] = value;
          totalEnvs++;
        }
      }

      logFn(
        'info',
        `Loaded ${totalEnvs} variables from ${result[1].length} different applications`
      );
    },
  });

  if (missing.length) {
    logFn('warn', `Could not fetch ${missing.length} env variables:`);

    for (const key of missing) {
      logFn('warn', `  - ${key}`);
    }
  }

  return variables;
}
