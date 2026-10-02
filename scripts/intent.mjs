import { createRequire, registerHooks } from 'node:module';

const workspaceRequire = createRequire(new URL('../package.json', import.meta.url));
const toolingRequire = createRequire(
  workspaceRequire.resolve('@zephyrcloudio/intent-tooling/compiler')
);
const compilerApiPath = toolingRequire.resolve('typescript');

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === 'typescript' ? compilerApiPath : specifier, context);
  },
});

const { main } = await import(
  new URL('../node_modules/@tanstack/intent/dist/cli.mjs', import.meta.url)
);
process.exitCode = await main();
