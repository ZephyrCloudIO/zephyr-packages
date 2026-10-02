// Rewrites ZE_PUBLIC_* env reads into runtime lookups scoped by application UID.
// CommonJS to be consumable by Rspack; runs as an `enforce: 'pre'` loader so the
// JS transform rules (SWC/Babel) and Hermes only ever see rewritten code.

const { rewriteEnvReadsToNativeLookup } = require('zephyr-agent');

module.exports = function envNativeLoader(source, inputMap) {
  const { applicationUid, buildEnv } = this.getOptions();

  let result;
  try {
    result = rewriteEnvReadsToNativeLookup(String(source), {
      filename: this.resourcePath,
      applicationUid,
      buildEnv,
    });
  } catch (error) {
    // Never ship an un-rewritten read: it would silently be undefined on device.
    this.callback(error);
    return;
  }

  if (result === null) {
    this.callback(null, source, inputMap);
    return;
  }
  this.callback(null, result.code, result.map);
};
