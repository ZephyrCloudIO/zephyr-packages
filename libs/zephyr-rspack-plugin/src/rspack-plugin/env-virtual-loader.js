// Lightweight loader to rewrite ZE_PUBLIC_* env reads to a virtual module import
// CommonJS to be consumable by Rspack

module.exports = function envVirtualLoader(source) {
  const options = this && typeof this.getOptions === 'function' ? this.getOptions() : {};
  try {
    const api = require('zephyr-environment-variables');
    if (api && typeof api.rewriteEnvReadsToVirtualModule === 'function') {
      const res = api.rewriteEnvReadsToVirtualModule(
        String(source),
        options && options.specifier
      );
      if (res && typeof res.code === 'string') {
        return res.code;
      }
    }
  } catch (_e) {
    // fallthrough; return original source (we rely on the env lib for all env logic)
  }
  return source;
};
