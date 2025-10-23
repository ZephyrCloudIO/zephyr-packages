// Lightweight loader to rewrite ZE_PUBLIC_* env reads to a virtual module import
// CommonJS to be consumable by Rspack

const { rewriteEnvReadsToVirtualModule } = require('zephyr-agent');

module.exports = function envVirtualLoader(source) {
  const options = this && typeof this.getOptions === 'function' ? this.getOptions() : {};

  if (typeof rewriteEnvReadsToVirtualModule !== 'function') {
    return source;
  }

  try {
    const res = rewriteEnvReadsToVirtualModule(
      String(source),
      options && options.specifier
    );
    if (res && typeof res.code === 'string') {
      return res.code;
    }
  } catch (_e) {
    // fallthrough; return original source if rewrite fails
  }

  return source;
};
