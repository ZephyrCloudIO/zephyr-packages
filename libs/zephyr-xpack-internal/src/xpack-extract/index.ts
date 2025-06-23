export {
  createMfRuntimeCode,
  xpack_delegate_module_template,
} from './create-mf-runtime-code';
export {
  extractFederatedDependencyPairs,
  parseRemotesAsEntries,
} from './extract-federated-dependency-pairs';
export { extractFederatedConfig } from './extract-federation-config';
export { isModuleFederationPlugin } from './is-module-federation-plugin';
export { iterateFederationConfig } from './iterate-federation-config';
export { makeCopyOfModuleFederationOptions } from './make-copy-of-module-federation-options';
export { mutWebpackFederatedRemotesConfig } from './mut-webpack-federated-remotes-config';
export { createZephyrRuntimePlugin } from './runtimePlugin';
