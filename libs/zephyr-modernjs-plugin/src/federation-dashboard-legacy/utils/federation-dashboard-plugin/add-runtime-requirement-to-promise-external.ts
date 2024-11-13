import { Compilation, Compiler, Module } from 'webpack';

export class AddRuntimeRequirementToPromiseExternal {
  apply(compiler: Compiler): void {
    compiler.hooks.compilation.tap(
      'AddRuntimeRequirementToPromiseExternal',
      (compilation: Compilation) => {
        const { RuntimeGlobals } = compiler.webpack;
        if (compilation.outputOptions.trustedTypes) {
          compilation.hooks.additionalModuleRuntimeRequirements.tap(
            'AddRuntimeRequirementToPromiseExternal',
            (module: Module & { externalType?: string }, set) => {
              if (module.externalType === 'promise') {
                set.add(RuntimeGlobals.loadScript);
              }
            }
          );
        }
      }
    );
  }
}
