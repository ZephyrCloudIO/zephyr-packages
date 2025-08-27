import type { XCompilation, XCompiler, XModule, XChunk } from '../../../xpack.types';

export class AddRuntimeRequirementToPromiseExternal {
  apply(compiler: XCompiler): void {
    compiler.hooks.compilation.tap(
      'AddRuntimeRequirementToPromiseExternal',
      (compilation: XCompilation) => {
        // TODO: access runtime global
        const { RuntimeGlobals } = compiler.webpack;
        // compilation.outputOptions.trustedTypes are used in browser environment to ensure XSS attack, this won't be useful in React Native
        // reference: https://github.com/web-infra-dev/rspack/blob/52d7dcd48df764674f50e65b51297a7a697c15e7/packages/rspack/src/config/types.ts#L306
        if (compilation.outputOptions.trustedTypes) {
          // This is for Webpack
          if (compilation.outputOptions.trustedTypes) {
            compilation.hooks.additionalModuleRuntimeRequirements.tap(
              'AddRuntimeRequirementToPromiseExternal',
              (module: XModule & { externalType?: string }, set) => {
                if (module.externalType === 'promise') {
                  set.add(RuntimeGlobals.loadScript);
                }
              }
            );
          }

          // This is for Rspack (include Repack)
          compilation.hooks.additionalTreeRuntimeRequirements.tap(
            'AddRuntimeRequirementToPromiseExternal',
            (chunk: XChunk & { externalType?: string }, set) => {
              if (chunk.externalType === 'promise') {
                set.add(RuntimeGlobals.loadScript);
              }
            }
          );
        }

        // even if `trustedTypes` don't exists, there isn't an external type, load the script anyways
        // TODO: verify if this works
        compilation.hooks.additionalTreeRuntimeRequirements.tap(
          'AddRuntimeRequirementToPromiseExternal',
          (chunk: XChunk, set) => {
            set.add(RuntimeGlobals.loadScript);
          }
        );
      }
    );
  }
}
