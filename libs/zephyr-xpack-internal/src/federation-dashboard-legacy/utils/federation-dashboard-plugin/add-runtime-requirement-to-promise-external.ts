import { XCompilation, XCompiler, XModule } from '../../../xpack.types';

export class AddRuntimeRequirementToPromiseExternal {
  apply(compiler: XCompiler): void {
    compiler.hooks.compilation.tap(
      'AddRuntimeRequirementToPromiseExternal',
      (compilation: XCompilation) => {
        const { RuntimeGlobals } = compiler.webpack;
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
      }
    );
  }
}
