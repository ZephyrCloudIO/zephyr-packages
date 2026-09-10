import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { bootstrapMetroCommands } from '../metro-bootstrap.js';

describe('bootstrapMetroCommands', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zephyr-metro-bootstrap-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writePackageJson(value: Record<string, unknown>): void {
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(value));
  }

  it('creates a CommonJS React Native CLI config and companion requirements', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });

    const result = bootstrapMetroCommands(tempDir);
    const content = fs.readFileSync(path.join(tempDir, 'react-native.config.js'), 'utf8');

    expect(result.integration).toBe('react-native-cli');
    expect(result.createdFiles).toEqual(['react-native.config.js']);
    expect(result.packageRequirements.map(({ name }) => name)).toEqual([
      'zephyr-metro-plugin',
      '@module-federation/metro',
    ]);
    expect(result.packageRequirements[1]?.version).toBe('^2.9.0');
    expect(content).toContain('module.exports = zephyrMetroReactNativeCli()');
  });

  it('leaves an incompatible installed Metro command package untouched', () => {
    writePackageJson({
      devDependencies: {
        '@react-native-community/cli': '^19.0.0',
        '@module-federation/metro': '^2.8.0',
      },
    });

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('ambiguous');
    expect(result.createdFiles).toEqual([]);
    expect(result.manualGuidance[0]).toContain('Use ^2.9.0');
  });

  it('preserves existing React Native CLI config and commands', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const configPath = path.join(tempDir, 'react-native.config.js');
    fs.writeFileSync(
      configPath,
      'module.exports = { assets: ["./assets"], commands: [customCommand] };\n'
    );

    const first = bootstrapMetroCommands(tempDir);
    const second = bootstrapMetroCommands(tempDir);
    const content = fs.readFileSync(configPath, 'utf8');

    expect(first.updatedFiles).toEqual(['react-native.config.js']);
    expect(second.updatedFiles).toEqual([]);
    expect(content).toContain('assets: ["./assets"]');
    expect(content).toContain('...(__zephyrReactNativeConfig.commands ?? [])');
    expect(content.match(/zephyrMetroReactNativeCli\(\)\.commands/g)).toHaveLength(1);
  });

  it('updates an ESM React Native CLI config', () => {
    writePackageJson({
      type: 'module',
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const configPath = path.join(tempDir, 'react-native.config.js');
    fs.writeFileSync(configPath, 'export default { assets: ["./assets"] };\n');

    const result = bootstrapMetroCommands(tempDir);
    const content = fs.readFileSync(configPath, 'utf8');

    expect(result.updatedFiles).toEqual(['react-native.config.js']);
    expect(content).toContain('import { zephyrMetroReactNativeCli }');
    expect(content).toContain('const __zephyrReactNativeConfig = {');
    expect(content).toContain('...zephyrMetroReactNativeCli().commands');
  });

  it('registers the existing RNEF plugin without replacing config', () => {
    writePackageJson({ devDependencies: { '@rnef/cli': '^0.8.0' } });
    const configPath = path.join(tempDir, 'rnef.config.mjs');
    fs.writeFileSync(
      configPath,
      'const existingPlugin = () => ({});\nexport default { plugins: [existingPlugin()] };\n'
    );

    const result = bootstrapMetroCommands(tempDir);
    const content = fs.readFileSync(configPath, 'utf8');

    expect(result.integration).toBe('rnef');
    expect(result.updatedFiles).toEqual(['rnef.config.mjs']);
    expect(content).toContain('plugins: [existingPlugin()]');
    expect(content).toContain('...(__zephyrRnefConfig.plugins ?? [])');
    expect(content).toContain('zephyrMetroRNEFPlugin()');
  });

  it('makes no changes during a dry run', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });

    const result = bootstrapMetroCommands(tempDir, { dryRun: true });

    expect(result.createdFiles).toEqual(['react-native.config.js']);
    expect(fs.existsSync(path.join(tempDir, 'react-native.config.js'))).toBe(false);
  });

  it('does not edit ambiguous projects and gives exact manual guidance', () => {
    writePackageJson({
      dependencies: { react: '^19.0.0' },
    });

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('ambiguous');
    expect(result.createdFiles).toEqual([]);
    expect(result.updatedFiles).toEqual([]);
    expect(result.packageRequirements).toEqual([]);
    expect(result.manualGuidance).toEqual([
      'No React Native command config was changed because the integration could not be updated safely.',
      'React Native CLI: export commands: [...(config.commands ?? []), ...zephyrMetroReactNativeCli().commands] from react-native.config.js and import zephyrMetroReactNativeCli from zephyr-metro-plugin.',
      'RNEF: add zephyrMetroRNEFPlugin() to the exported plugins array in rnef.config.* and import zephyrMetroRNEFPlugin from zephyr-metro-plugin.',
    ]);
  });

  it('updates the existing React Native CLI filename instead of shadowing it', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const configPath = path.join(tempDir, 'react-native.config.cjs');
    fs.writeFileSync(configPath, 'module.exports = { assets: ["./assets"] };\n');

    const result = bootstrapMetroCommands(tempDir);

    expect(result.updatedFiles).toEqual(['react-native.config.cjs']);
    expect(fs.existsSync(path.join(tempDir, 'react-native.config.js'))).toBe(false);
    expect(fs.readFileSync(configPath, 'utf8')).toContain(
      'zephyrMetroReactNativeCli().commands'
    );
  });

  it('leaves multiple React Native CLI config candidates untouched', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const jsConfig = 'module.exports = { assets: ["js"] };\n';
    const cjsConfig = 'module.exports = { assets: ["cjs"] };\n';
    fs.writeFileSync(path.join(tempDir, 'react-native.config.js'), jsConfig);
    fs.writeFileSync(path.join(tempDir, 'react-native.config.cjs'), cjsConfig);

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('ambiguous');
    expect(fs.readFileSync(path.join(tempDir, 'react-native.config.js'), 'utf8')).toBe(
      jsConfig
    );
    expect(fs.readFileSync(path.join(tempDir, 'react-native.config.cjs'), 'utf8')).toBe(
      cjsConfig
    );
  });

  it('leaves unsupported React Native config candidates untouched', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const content = 'export default { assets: [] };\n';
    fs.writeFileSync(path.join(tempDir, 'react-native.config.mts'), content);

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('ambiguous');
    expect(fs.readFileSync(path.join(tempDir, 'react-native.config.mts'), 'utf8')).toBe(
      content
    );
    expect(fs.existsSync(path.join(tempDir, 'react-native.config.js'))).toBe(false);
  });

  it('gives explicit RNEF package signals precedence over CLI dependencies', () => {
    writePackageJson({
      devDependencies: {
        '@react-native-community/cli': '^19.0.0',
        '@rnef/cli': '^0.8.0',
      },
    });

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('rnef');
    expect(result.createdFiles).toEqual(['rnef.config.js']);
    expect(fs.existsSync(path.join(tempDir, 'react-native.config.js'))).toBe(false);
  });

  it('gives an explicit RNEF config precedence over CLI dependencies', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const configPath = path.join(tempDir, 'rnef.config.ts');
    fs.writeFileSync(configPath, 'export default { plugins: [] };\n');

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('rnef');
    expect(result.updatedFiles).toEqual(['rnef.config.ts']);
    expect(fs.existsSync(path.join(tempDir, 'react-native.config.js'))).toBe(false);
  });

  it('leaves genuinely conflicting companion configs untouched', () => {
    writePackageJson({ devDependencies: { '@rnef/cli': '^0.8.0' } });
    const reactNativeContent = 'module.exports = { commands: [] };\n';
    const rnefContent = 'export default { plugins: [] };\n';
    fs.writeFileSync(path.join(tempDir, 'react-native.config.js'), reactNativeContent);
    fs.writeFileSync(path.join(tempDir, 'rnef.config.mjs'), rnefContent);

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('ambiguous');
    expect(fs.readFileSync(path.join(tempDir, 'react-native.config.js'), 'utf8')).toBe(
      reactNativeContent
    );
    expect(fs.readFileSync(path.join(tempDir, 'rnef.config.mjs'), 'utf8')).toBe(
      rnefContent
    );
  });

  it('detects existing helper calls with arguments and whitespace', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const configPath = path.join(tempDir, 'react-native.config.ts');
    const content = `import { zephyrMetroReactNativeCli } from "zephyr-metro-plugin";\nexport default zephyrMetroReactNativeCli ( { projectRoot: process.cwd() } );\n`;
    fs.writeFileSync(configPath, content);

    const result = bootstrapMetroCommands(tempDir);

    expect(result.updatedFiles).toEqual([]);
    expect(result.packageRequirements).not.toEqual([]);
    expect(fs.readFileSync(configPath, 'utf8')).toBe(content);
  });

  it('detects existing calls through an aliased helper import', () => {
    writePackageJson({
      type: 'module',
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const configPath = path.join(tempDir, 'react-native.config.mjs');
    const content = `import { zephyrMetroReactNativeCli as zephyrCommands } from "zephyr-metro-plugin";\nexport default zephyrCommands();\n`;
    fs.writeFileSync(configPath, content);

    const result = bootstrapMetroCommands(tempDir);

    expect(result.updatedFiles).toEqual([]);
    expect(fs.readFileSync(configPath, 'utf8')).toBe(content);
  });

  it('uses an existing CommonJS helper alias when adding commands', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const configPath = path.join(tempDir, 'react-native.config.cjs');
    fs.writeFileSync(
      configPath,
      `const { zephyrMetroReactNativeCli: zephyrCommands } = require("zephyr-metro-plugin");\nmodule.exports = { assets: [] };\n`
    );

    const result = bootstrapMetroCommands(tempDir);
    const content = fs.readFileSync(configPath, 'utf8');

    expect(result.updatedFiles).toEqual(['react-native.config.cjs']);
    expect(content).toContain('...zephyrCommands().commands');
    expect(content).not.toContain('...zephyrMetroReactNativeCli().commands');
  });

  it('does not treat helper text in a comment as command registration', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const configPath = path.join(tempDir, 'react-native.config.js');
    fs.writeFileSync(
      configPath,
      '// zephyrMetroReactNativeCli() is added below by the codemod\nmodule.exports = { assets: [] };\n'
    );

    const result = bootstrapMetroCommands(tempDir);

    expect(result.updatedFiles).toEqual(['react-native.config.js']);
    expect(fs.readFileSync(configPath, 'utf8')).toContain(
      '...zephyrMetroReactNativeCli().commands'
    );
  });

  for (const [name, exportedValue] of [
    ['function', '() => ({ commands: [] })'],
    ['promise', 'Promise.resolve({ commands: [] })'],
    ['non-object', '"config"'],
  ]) {
    it(`leaves CommonJS ${name} exports unchanged`, () => {
      writePackageJson({
        devDependencies: { '@react-native-community/cli': '^19.0.0' },
      });
      const configPath = path.join(tempDir, 'react-native.config.js');
      const content = `module.exports = ${exportedValue};\n`;
      fs.writeFileSync(configPath, content);

      const result = bootstrapMetroCommands(tempDir);

      expect(result.manualGuidance[0]).toContain('does not directly export an object');
      expect(result.packageRequirements).toEqual([]);
      expect(fs.readFileSync(configPath, 'utf8')).toBe(content);
    });
  }

  it('leaves unsupported ESM exports unchanged', () => {
    writePackageJson({
      type: 'module',
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const configPath = path.join(tempDir, 'react-native.config.mjs');
    const content = 'export default getConfig();\n';
    fs.writeFileSync(configPath, content);

    const result = bootstrapMetroCommands(tempDir);

    expect(result.manualGuidance[0]).toContain('does not directly export an object');
    expect(fs.readFileSync(configPath, 'utf8')).toBe(content);
  });

  it('leaves multiple active RNEF loader candidates untouched', () => {
    writePackageJson({ devDependencies: { '@rnef/cli': '^0.8.0' } });
    const jsContent = 'module.exports = { plugins: [] };\n';
    const mjsContent = 'export default { plugins: [] };\n';
    fs.writeFileSync(path.join(tempDir, 'rnef.config.js'), jsContent);
    fs.writeFileSync(path.join(tempDir, 'rnef.config.mjs'), mjsContent);

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('ambiguous');
    expect(fs.readFileSync(path.join(tempDir, 'rnef.config.js'), 'utf8')).toBe(jsContent);
    expect(fs.readFileSync(path.join(tempDir, 'rnef.config.mjs'), 'utf8')).toBe(
      mjsContent
    );
  });
});
