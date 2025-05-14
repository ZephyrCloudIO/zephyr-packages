const symbolStr = `Symbol.for('ze_envs')`;

/**
 * A string code reference to `window[Symbol.for('ze_envs')]`
 *
 * This is used to replace the envs in the code with the actual envs when the code is
 * executed in the browser.
 */
export const ZephyrEnvsGlobal = `window[${symbolStr}]`;

// Source:
// const symbol = Symbol.for('ze_envs');
// //@ts-ignore
// let envs = window[symbol];
// if (!envs) {
//   Object.defineProperty(window, symbol, {
//     value: (envs = {}),
//     writable: false,
//     enumerable: false,
//     configurable: false,
//   });
// }
// for (const entries of JSON.parse(atob('${envs}'))) {
//   if (!envs[entries[0]]) {
//     Object.defineProperty(envs, entries[0], {
//       value: entries[1],
//       writable: false,
//       enumerable: false,
//       configurable: false,
//     });
//   }
// }

/** Creates the string content of a ze-envs.js file for the provided envs record. */
export function createZeEnvsFile(envs: Record<string, string>) {
  const entries = JSON.stringify(Object.entries(envs));
  const base64Json = Buffer.from(entries).toString('base64');
  return (
    `// https://docs.zephyr-cloud.io/environment-variables\n` +
    // declare some variables
    `(()=>{var N=Symbol.for("ze_envs"),j=window[N];` +
    // define non numerable window[ze_envs]
    `j||Object.defineProperty(window,N,{value:j={},writable:!1,enumerable:!1,configurable:!1});` +
    // loops on each env entry
    `for(var m of JSON.parse(atob("${base64Json}")))` +
    // Define all missing properties as non-writable, non-enumerable and non-configurable
    `j[m[0]]||Object.defineProperty(j,m[0],{value:m[1],writable:!1,enumerable:!1,configurable:!1})})();\n`
  );
}
