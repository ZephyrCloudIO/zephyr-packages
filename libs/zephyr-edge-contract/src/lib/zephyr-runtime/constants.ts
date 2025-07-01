const symbolStr = `Symbol.for('zephyr-runtime')`;

export const ZephyrRuntimeConstants = {
  /**
   * The filename of the Zephyr runtime script that is injected into the page.
   *
   * It may be used for many reasons, such as:
   *
   * - To provide and load environment variables at runtime
   */
  filename: 'zephyr-runtime.js',

  /** A string code reference to the Zephyr runtime global symbol. */
  globalSymbol: symbolStr,

  /**
   * A string code reference to the Zephyr runtime global object.
   *
   * This is used to access the Zephyr runtime in the browser.
   */
  globalObject: `window[${symbolStr}]`,

  /**
   * The field name used to store the runtime environment variables in the Zephyr runtime
   * global object.
   */
  envVarsField: 'envs',

  /**
   * The field name used to store the runtime dependencies in the Zephyr runtime global
   * object.
   */
  dependenciesField: 'deps',
} as const;
