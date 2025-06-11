const symbolStr = `Symbol.for('ze_envs')`;

/**
 * A string code reference to `window[Symbol.for('ze_envs')]`
 *
 * This is used to replace the envs in the code with the actual envs when the code is
 * executed in the browser.
 */
export const ZephyrEnvsGlobal = `window[${symbolStr}]`;

/** Simple helper function to create a record of variables from the used variables */
export async function createVariablesRecord(
  uses: Iterable<string>,
  dictionary: Record<string, string | undefined>,
  // Warns in the CLI of missing variables
  onNotFound?: string[] | ((key: string) => void),

  // Performs an async request and append result into variables
  requestMissingVariables?: (
    this: void,
    names: string[],
    variables: Record<string, string>
  ) => void | Promise<void>
) {
  const variables: Record<string, string> = {};
  const missing: string[] = [];

  for (const key of uses) {
    const value = dictionary[key];

    // Skip 0, '' and false values
    if (value === undefined || value === null) {
      missing.push(key);
    } else {
      variables[key] ??= value;
    }
  }

  // Attempts to request missing values
  if (requestMissingVariables) {
    await requestMissingVariables(missing, variables);
  }

  for (const key of missing) {
    if (!variables[key]) {
      variables[key] = `(Missing value for ${key})`;

      switch (typeof onNotFound) {
        case 'function':
          onNotFound(key);
          break;
        case 'object':
          onNotFound.push(key);
          break;
      }
    }
  }

  return variables;
}

/** Creates the string content of a ze-envs.js file for the provided envs record. */
export function createZeEnvsFile(envs: Record<string, string>) {
  const entries = JSON.stringify(Object.entries(envs));
  // Values here are public so base64 obscurity is just to avoid simple inspect+search
  const base64Json = Buffer.from(entries).toString('base64');

  return (
    /* js */ `
// https://docs.zephyr-cloud.io/environment-variables

(()=>{
  let S=Symbol.for("ze_envs"),
      e=window[S];

  // Only defined window[Symbol.for('ze_envs')] if it doesn't exist
  // Non enumerable and non-writable to reduce scope of potential conflicts
  e||Object.defineProperty(window,S,{
    value:e={},
    writable:!1,
    enumerable:!1
  });

  // loops on each env entry
  for(let i of JSON.parse(atob("${base64Json}"))){
    // On a per-env entry basis, only define it if it doesn't exist
    // Bundler envs gets replaced into literals, non-writable here is an attempt
    // to keep the same "immutability" as the bundler envs
    e[i[0]]||Object.defineProperty(e,i[0],{
      value:i[1],
      writable:!1,
      enumerable:!1
    });
  }
})();
`
      // Removes comment lines
      .replace(/^\s*\/\/.*/gm, '')
      // Removes line breaks added for readability
      .replace(/\n\s*/g, '')
  );
}
