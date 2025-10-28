import { rewriteEnvReadsToVirtualModule } from '../index';

const SPEC = 'env:vars:app';

function rewrite(code: string): string {
  return rewriteEnvReadsToVirtualModule(code, SPEC).code;
}

describe('rewriteEnvReadsToVirtualModule', () => {
  test('simple member access: process.env.ZE_PUBLIC_FOO', () => {
    const src = `console.log(process.env.ZE_PUBLIC_FOO)`;
    const out = rewrite(src);
    expect(out).toContain(`import __ZE_MANIFEST__ from '${SPEC}' with { type: 'json' }`);
    expect(out).toContain(`__ZE_MANIFEST__.zeVars.ZE_PUBLIC_FOO`);
  });

  test('bracket access: process.env["ZE_PUBLIC_FOO"]', () => {
    const src = `console.log(process.env["ZE_PUBLIC_FOO"])`;
    const out = rewrite(src);
    expect(out).toContain(`__ZE_MANIFEST__.zeVars.ZE_PUBLIC_FOO`);
  });

  test('import.meta.env.ZE_PUBLIC_FOO', () => {
    const src = `alert(import.meta.env.ZE_PUBLIC_FOO)`;
    const out = rewrite(src);
    expect(out).toContain(`__ZE_MANIFEST__.zeVars.ZE_PUBLIC_FOO`);
  });

  test('import.meta.env["ZE_PUBLIC_FOO"]', () => {
    const src = `alert(import.meta.env["ZE_PUBLIC_FOO"])`;
    const out = rewrite(src);
    expect(out).toContain(`__ZE_MANIFEST__.zeVars.ZE_PUBLIC_FOO`);
  });

  test('destructuring declaration from process.env', () => {
    const src = `const { ZE_PUBLIC_FOO } = process.env; console.log(ZE_PUBLIC_FOO);`;
    const out = rewrite(src);
    expect(out).toContain(`import __ZE_MANIFEST__ from '${SPEC}' with { type: 'json' }`);
    expect(out).toContain(`const { ZE_PUBLIC_FOO } = __ZE_MANIFEST__.zeVars`);
  });

  test('destructuring declaration with alias and default', () => {
    const src = `const { ZE_PUBLIC_FOO: FOO = 'x', OTHER } = process.env; console.log(FOO, OTHER);`;
    const out = rewrite(src);
    // Only RHS replaced
    expect(out).toContain(
      `const { ZE_PUBLIC_FOO: FOO = 'x', OTHER } = __ZE_MANIFEST__.zeVars`
    );
  });

  test('destructuring assignment from import.meta.env', () => {
    const src = `let A; ({ ZE_PUBLIC_BAR: A } = import.meta.env);`;
    const out = rewrite(src);
    expect(out).toContain(`{ ZE_PUBLIC_BAR: A } = __ZE_MANIFEST__.zeVars`);
  });

  test('mixed destructuring: only ZE_PUBLIC_* should trigger RHS replacement', () => {
    const src = `const { SECRET, ZE_PUBLIC_OK } = import.meta.env;`;
    const out = rewrite(src);
    expect(out).toContain(`{ SECRET, ZE_PUBLIC_OK } = __ZE_MANIFEST__.zeVars`);
  });

  test('template literals with member access', () => {
    const src = 'const s = `x-${process.env.ZE_PUBLIC_FOO}-y`';
    const out = rewrite(src);
    expect(out).toContain('`x-${__ZE_MANIFEST__.zeVars.ZE_PUBLIC_FOO}-y`');
  });

  test('does not rewrite non ZE_PUBLIC_ keys', () => {
    const src = `console.log(process.env.SECRET, import.meta.env.VITE_FOO)`;
    const out = rewrite(src);
    expect(out).not.toContain(`__ZE_MANIFEST__`);
  });

  test('quoted key with single quotes', () => {
    const src = `console.log(process.env['ZE_PUBLIC_BAR'])`;
    const out = rewrite(src);
    expect(out).toContain(`__ZE_MANIFEST__.zeVars.ZE_PUBLIC_BAR`);
  });

  test('multiple occurrences add a single import', () => {
    const src = `console.log(process.env.ZE_PUBLIC_A, import.meta.env.ZE_PUBLIC_B)`;
    const out = rewrite(src);
    const importCount =
      out.split(`import __ZE_MANIFEST__ from '${SPEC}' with { type: 'json' }`).length - 1;
    expect(importCount).toBe(1);
    expect(out).toContain(`__ZE_MANIFEST__.zeVars.ZE_PUBLIC_A`);
    expect(out).toContain(`__ZE_MANIFEST__.zeVars.ZE_PUBLIC_B`);
  });

  test('already-imported virtual module should not duplicate import', () => {
    const src = `import __ZE_MANIFEST__ from '${SPEC}' with { type: 'json' }; console.log(process.env.ZE_PUBLIC_A)`;
    const out = rewrite(src);
    const importCount =
      out.split(`import __ZE_MANIFEST__ from '${SPEC}' with { type: 'json' }`).length - 1;
    expect(importCount).toBe(1);
    expect(out).toContain(`__ZE_MANIFEST__.zeVars.ZE_PUBLIC_A`);
  });
});
