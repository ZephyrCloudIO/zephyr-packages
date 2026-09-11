import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { bootstrapMetroCommands } from '../metro-bootstrap.js';

describe('bootstrapMetroCommands', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zephyr-metro-bootstrap-'));
    fs.writeFileSync(
      path.join(tempDir, 'metro.config.js'),
      `const { withModuleFederation } = require("@module-federation/metro");\nmodule.exports = withModuleFederation({}, { name: "app" });\n`
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writePackageJson(value: Record<string, unknown>): void {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        ...value,
        dependencies: {
          react: '^19.0.0',
          'react-native': '^0.79.0',
          ...(value['dependencies'] as Record<string, string> | undefined),
        },
        devDependencies: {
          '@babel/types': '^7.25.0',
          metro: '^0.82.1',
          'metro-config': '^0.82.1',
          'metro-file-map': '^0.82.1',
          'metro-resolver': '^0.82.1',
          'metro-source-map': '^0.82.1',
          ...(value['devDependencies'] as Record<string, string> | undefined),
        },
      })
    );
  }

  function writeResolvedPackage(
    packageName: string,
    version: string,
    directory = tempDir
  ): string {
    const packageDirectory = path.join(
      directory,
      'node_modules',
      ...packageName.split('/')
    );
    fs.mkdirSync(packageDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(packageDirectory, 'package.json'),
      JSON.stringify({ name: packageName, version })
    );
    return packageDirectory;
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
    expect(result.packageRequirements[0]?.version).toBe('^1.4.0');
    expect(result.packageRequirements[0]?.projectDirectory).toBe(tempDir);
    expect(content).toContain('module.exports = zephyrMetroReactNativeCli()');
  });

  it('requires an adapter-capable plugin upgrade', () => {
    writePackageJson({
      devDependencies: {
        '@react-native-community/cli': '^19.0.0',
        'zephyr-metro-plugin': '^1.3.0',
      },
    });

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('react-native-cli');
    expect(result.packageRequirements[0]).toEqual({
      name: 'zephyr-metro-plugin',
      isDev: true,
      version: '^1.4.0',
      projectDirectory: tempDir,
      requireResolved: true,
    });
  });

  it('preserves production dependency placement when upgrading the adapter', () => {
    writePackageJson({
      dependencies: {
        'react-native': '^0.79.0',
        'zephyr-metro-plugin': '^1.3.0',
      },
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });

    const result = bootstrapMetroCommands(tempDir);

    expect(result.packageRequirements[0]).toEqual({
      name: 'zephyr-metro-plugin',
      isDev: false,
      version: '^1.4.0',
      projectDirectory: tempDir,
      requireResolved: true,
    });
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

  it('avoids temporary binding collisions in CommonJS and ESM configs', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const commonJsPath = path.join(tempDir, 'react-native.config.js');
    fs.writeFileSync(
      commonJsPath,
      'const __zephyrReactNativeConfig = "existing";\nmodule.exports = { commands: [] };\n'
    );

    expect(bootstrapMetroCommands(tempDir).updatedFiles).toEqual([
      'react-native.config.js',
    ]);
    expect(fs.readFileSync(commonJsPath, 'utf8')).toContain(
      'const __zephyrReactNativeConfig2 = module.exports;'
    );

    fs.rmSync(commonJsPath);
    writePackageJson({
      type: 'module',
      devDependencies: { '@rnef/cli': '^0.8.0' },
    });
    const esmPath = path.join(tempDir, 'rnef.config.mjs');
    fs.writeFileSync(
      esmPath,
      'const __zephyrRnefConfig = "existing";\nexport default { plugins: [] };\n'
    );

    expect(bootstrapMetroCommands(tempDir).updatedFiles).toEqual(['rnef.config.mjs']);
    expect(fs.readFileSync(esmPath, 'utf8')).toContain('const __zephyrRnefConfig2 = {');
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
      'React Native CLI: export commands: [...(config.commands ?? []), ...zephyrMetroReactNativeCli().commands] from the active react-native.config.* file and import zephyrMetroReactNativeCli from zephyr-metro-plugin.',
      'RNEF: add zephyrMetroRNEFPlugin() to the exported plugins array in the active rnef.config.* file and import zephyrMetroRNEFPlugin from zephyr-metro-plugin.',
      'Publish with --platform <platform> after registration.',
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

  it('detects React Native commands through a CommonJS namespace import', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const configPath = path.join(tempDir, 'react-native.config.js');
    const content = `const zephyr = require("zephyr-metro-plugin");\nmodule.exports = { commands: [...zephyr.zephyrMetroReactNativeCli().commands] };\n`;
    fs.writeFileSync(configPath, content);

    const result = bootstrapMetroCommands(tempDir);

    expect(result.updatedFiles).toEqual([]);
    expect(fs.readFileSync(configPath, 'utf8')).toBe(content);
  });

  it('detects RNEF plugins through an ESM namespace import', () => {
    writePackageJson({
      type: 'module',
      devDependencies: { '@rnef/cli': '^0.8.0' },
    });
    const configPath = path.join(tempDir, 'rnef.config.mjs');
    const content = `import * as zephyr from "zephyr-metro-plugin";\nexport default { plugins: [zephyr.zephyrMetroRNEFPlugin()] };\n`;
    fs.writeFileSync(configPath, content);

    const result = bootstrapMetroCommands(tempDir);

    expect(result.updatedFiles).toEqual([]);
    expect(fs.readFileSync(configPath, 'utf8')).toBe(content);
  });

  it('reuses a namespace import when adding missing commands', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const configPath = path.join(tempDir, 'react-native.config.js');
    fs.writeFileSync(
      configPath,
      `const zephyr = require("zephyr-metro-plugin");\nmodule.exports = { commands: [] };\n`
    );

    const result = bootstrapMetroCommands(tempDir);
    const content = fs.readFileSync(configPath, 'utf8');

    expect(result.updatedFiles).toEqual(['react-native.config.js']);
    expect(content).toContain('...zephyr.zephyrMetroReactNativeCli().commands');
    expect(content.match(/require\("zephyr-metro-plugin"\)/g)).toHaveLength(1);
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
      '// const { zephyrMetroReactNativeCli } = require("zephyr-metro-plugin");\n// zephyrMetroReactNativeCli() is added below by the codemod\nmodule.exports = { assets: [] };\n'
    );

    const result = bootstrapMetroCommands(tempDir);

    expect(result.updatedFiles).toEqual(['react-native.config.js']);
    const content = fs.readFileSync(configPath, 'utf8');
    expect(content).toContain('...zephyrMetroReactNativeCli().commands');
    expect(content).toContain(
      '\nconst { zephyrMetroReactNativeCli } = require("zephyr-metro-plugin");\n'
    );
  });

  it('does not treat an unused local adapter call as command registration', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const configPath = path.join(tempDir, 'react-native.config.js');
    fs.writeFileSync(
      configPath,
      `const { zephyrMetroReactNativeCli } = require("zephyr-metro-plugin");\nconst unused = zephyrMetroReactNativeCli({ projectRoot: __dirname });\nmodule.exports = { commands: [] };\n`
    );

    const result = bootstrapMetroCommands(tempDir);

    expect(result.updatedFiles).toEqual(['react-native.config.js']);
    expect(fs.readFileSync(configPath, 'utf8')).toContain(
      '...zephyrMetroReactNativeCli().commands'
    );
  });

  it('rejects a registered adapter replaced by a later CommonJS export', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const configPath = path.join(tempDir, 'react-native.config.js');
    const content =
      'const { zephyrMetroReactNativeCli } = require("zephyr-metro-plugin");\nmodule.exports = zephyrMetroReactNativeCli();\nmodule.exports = { commands: [] };\n';
    fs.writeFileSync(configPath, content);

    const result = bootstrapMetroCommands(tempDir);

    expect(result.packageRequirements).toEqual([]);
    expect(result.manualGuidance[0]).toContain('does not directly export an object');
    expect(fs.readFileSync(configPath, 'utf8')).toBe(content);
  });

  it('recognizes adapter commands merged into the exported config', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const configPath = path.join(tempDir, 'react-native.config.js');
    const content = `const { zephyrMetroReactNativeCli } = require("zephyr-metro-plugin");\nconst base = { commands: [] };\nmodule.exports = { ...base, commands: [...base.commands, ...zephyrMetroReactNativeCli({ projectRoot: __dirname }).commands] };\n`;
    fs.writeFileSync(configPath, content);

    const result = bootstrapMetroCommands(tempDir);

    expect(result.updatedFiles).toEqual([]);
    expect(fs.readFileSync(configPath, 'utf8')).toBe(content);
  });

  it('recognizes adapter results referenced by the exported commands', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const configPath = path.join(tempDir, 'react-native.config.js');
    const content = `const { zephyrMetroReactNativeCli } = require("zephyr-metro-plugin");\nconst adapter = zephyrMetroReactNativeCli();\nmodule.exports = { commands: adapter.commands };\n`;
    fs.writeFileSync(configPath, content);

    const result = bootstrapMetroCommands(tempDir);

    expect(result.updatedFiles).toEqual([]);
    expect(fs.readFileSync(configPath, 'utf8')).toBe(content);
  });

  it('does not treat an unused local RNEF plugin call as registration', () => {
    writePackageJson({ devDependencies: { '@rnef/cli': '^0.8.0' } });
    const configPath = path.join(tempDir, 'rnef.config.js');
    fs.writeFileSync(
      configPath,
      `const { zephyrMetroRNEFPlugin } = require("zephyr-metro-plugin");\nconst unused = zephyrMetroRNEFPlugin({ platforms: {} });\nmodule.exports = { plugins: [] };\n`
    );

    const result = bootstrapMetroCommands(tempDir);

    expect(result.updatedFiles).toEqual(['rnef.config.js']);
    expect(fs.readFileSync(configPath, 'utf8')).toContain('zephyrMetroRNEFPlugin()');
  });

  it('recognizes RNEF plugins merged into the exported config', () => {
    writePackageJson({ devDependencies: { '@rnef/cli': '^0.8.0' } });
    const configPath = path.join(tempDir, 'rnef.config.mjs');
    const content = `import { zephyrMetroRNEFPlugin } from "zephyr-metro-plugin";\nconst base = { plugins: [] };\nexport default { ...base, plugins: [...base.plugins, zephyrMetroRNEFPlugin({ platforms: {} })] };\n`;
    fs.writeFileSync(configPath, content);

    const result = bootstrapMetroCommands(tempDir);

    expect(result.updatedFiles).toEqual([]);
    expect(fs.readFileSync(configPath, 'utf8')).toBe(content);
  });

  it('recognizes RNEF plugin results referenced by the exported plugins', () => {
    writePackageJson({ devDependencies: { '@rnef/cli': '^0.8.0' } });
    const configPath = path.join(tempDir, 'rnef.config.js');
    const content = `const { zephyrMetroRNEFPlugin } = require("zephyr-metro-plugin");\nconst plugin = zephyrMetroRNEFPlugin();\nmodule.exports = { plugins: [plugin] };\n`;
    fs.writeFileSync(configPath, content);

    const result = bootstrapMetroCommands(tempDir);

    expect(result.updatedFiles).toEqual([]);
    expect(fs.readFileSync(configPath, 'utf8')).toBe(content);
  });

  it('recognizes quoted and computed React Native command keys', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const cjsPath = path.join(tempDir, 'react-native.config.cjs');
    const cjsContent = `const { zephyrMetroReactNativeCli } = require("zephyr-metro-plugin");\nmodule.exports = { "commands": zephyrMetroReactNativeCli().commands };\n`;
    fs.writeFileSync(cjsPath, cjsContent);

    expect(bootstrapMetroCommands(tempDir).updatedFiles).toEqual([]);
    expect(fs.readFileSync(cjsPath, 'utf8')).toBe(cjsContent);

    fs.rmSync(cjsPath);
    const esmPath = path.join(tempDir, 'react-native.config.mjs');
    const esmContent = `import { zephyrMetroReactNativeCli } from "zephyr-metro-plugin";\nexport default { ["commands"]: [...zephyrMetroReactNativeCli().commands] };\n`;
    fs.writeFileSync(esmPath, esmContent);

    expect(bootstrapMetroCommands(tempDir).updatedFiles).toEqual([]);
    expect(fs.readFileSync(esmPath, 'utf8')).toBe(esmContent);
  });

  it('recognizes quoted and computed RNEF plugin keys', () => {
    writePackageJson({ devDependencies: { '@rnef/cli': '^0.8.0' } });
    const cjsPath = path.join(tempDir, 'rnef.config.js');
    const cjsContent = `const { zephyrMetroRNEFPlugin } = require("zephyr-metro-plugin");\nmodule.exports = { ["plugins"]: [zephyrMetroRNEFPlugin()] };\n`;
    fs.writeFileSync(cjsPath, cjsContent);

    expect(bootstrapMetroCommands(tempDir).updatedFiles).toEqual([]);
    expect(fs.readFileSync(cjsPath, 'utf8')).toBe(cjsContent);

    fs.rmSync(cjsPath);
    const esmPath = path.join(tempDir, 'rnef.config.mjs');
    const esmContent = `import { zephyrMetroRNEFPlugin } from "zephyr-metro-plugin";\nexport default { "plugins": [zephyrMetroRNEFPlugin()] };\n`;
    fs.writeFileSync(esmPath, esmContent);

    expect(bootstrapMetroCommands(tempDir).updatedFiles).toEqual([]);
    expect(fs.readFileSync(esmPath, 'utf8')).toBe(esmContent);
  });

  it('does not treat helpers nested in callbacks as registration', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const configPath = path.join(tempDir, 'react-native.config.js');
    fs.writeFileSync(
      configPath,
      `const { zephyrMetroReactNativeCli } = require("zephyr-metro-plugin");\nmodule.exports = { commands: [() => zephyrMetroReactNativeCli().commands] };\n`
    );

    const result = bootstrapMetroCommands(tempDir);

    expect(result.updatedFiles).toEqual(['react-native.config.js']);
    expect(fs.readFileSync(configPath, 'utf8')).toContain(
      '...zephyrMetroReactNativeCli().commands'
    );

    fs.rmSync(configPath);
    writePackageJson({ devDependencies: { '@rnef/cli': '^0.8.0' } });
    const rnefPath = path.join(tempDir, 'rnef.config.js');
    fs.writeFileSync(
      rnefPath,
      `const { zephyrMetroRNEFPlugin } = require("zephyr-metro-plugin");\nmodule.exports = { plugins: [() => zephyrMetroRNEFPlugin()] };\n`
    );

    expect(bootstrapMetroCommands(tempDir).updatedFiles).toEqual(['rnef.config.js']);
    expect(fs.readFileSync(rnefPath, 'utf8')).toContain('zephyrMetroRNEFPlugin(),');
  });

  it('recognizes configured identifier exports in CommonJS and ESM', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const cjsPath = path.join(tempDir, 'react-native.config.js');
    const cjsContent = `const { zephyrMetroReactNativeCli } = require("zephyr-metro-plugin");\nconst config = { commands: [...zephyrMetroReactNativeCli().commands] };\nmodule.exports = config;\n`;
    fs.writeFileSync(cjsPath, cjsContent);

    expect(bootstrapMetroCommands(tempDir).updatedFiles).toEqual([]);
    expect(fs.readFileSync(cjsPath, 'utf8')).toBe(cjsContent);

    fs.rmSync(cjsPath);
    writePackageJson({
      type: 'module',
      devDependencies: { '@rnef/cli': '^0.8.0' },
    });
    const esmPath = path.join(tempDir, 'rnef.config.mjs');
    const esmContent = `import { zephyrMetroRNEFPlugin } from "zephyr-metro-plugin";\nconst config = { plugins: [zephyrMetroRNEFPlugin()] };\nexport default config;\n`;
    fs.writeFileSync(esmPath, esmContent);

    expect(bootstrapMetroCommands(tempDir).updatedFiles).toEqual([]);
    expect(fs.readFileSync(esmPath, 'utf8')).toBe(esmContent);
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

  it('preserves CommonJS shebangs and commented directive prologues', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    const configPath = path.join(tempDir, 'react-native.config.js');
    fs.writeFileSync(
      configPath,
      '#!/usr/bin/env node\n// Keep this config strict.\n"use strict"; // Retain strict behavior.\nmodule.exports = { commands: [] };\n'
    );

    const result = bootstrapMetroCommands(tempDir);
    const content = fs.readFileSync(configPath, 'utf8');

    expect(result.updatedFiles).toEqual(['react-native.config.js']);
    expect(content).toMatch(
      /^#!\/usr\/bin\/env node\n\/\/ Keep this config strict\.\n"use strict"; \/\/ Retain strict behavior\.\nconst \{ zephyrMetroReactNativeCli \}/
    );
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

  it('leaves plain non-federated Metro projects untouched', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    fs.writeFileSync(
      path.join(tempDir, 'metro.config.js'),
      'module.exports = { resolver: {} };\n'
    );
    const companionPath = path.join(tempDir, 'react-native.config.js');
    const companion = 'module.exports = { commands: [] };\n';
    fs.writeFileSync(companionPath, companion);

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('ambiguous');
    expect(result.packageRequirements).toEqual([]);
    expect(result.manualGuidance[0]).toContain(
      'is not verifiably configured with @module-federation/metro'
    );
    expect(fs.readFileSync(companionPath, 'utf8')).toBe(companion);
  });

  it('rejects a federation call that does not produce the exported Metro config', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    fs.writeFileSync(
      path.join(tempDir, 'metro.config.js'),
      `const { withModuleFederation } = require("@module-federation/metro");\nconst unused = withModuleFederation({}, { name: "app" });\nmodule.exports = { resolver: {} };\n`
    );

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('ambiguous');
    expect(result.packageRequirements).toEqual([]);
    expect(fs.existsSync(path.join(tempDir, 'react-native.config.js'))).toBe(false);
  });

  it('recognizes an aliased federation wrapper through an exported identifier', () => {
    writePackageJson({
      devDependencies: { '@react-native-community/cli': '^19.0.0' },
    });
    fs.writeFileSync(
      path.join(tempDir, 'metro.config.js'),
      `const { withModuleFederation: withMF } = require("@module-federation/metro");\nconst config = withMF({ name: "app" })({});\nmodule.exports = config;\n`
    );

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('react-native-cli');
    expect(result.createdFiles).toEqual(['react-native.config.js']);
  });

  it('rejects broad and protocol dependency declarations when unresolved', () => {
    writePackageJson({
      dependencies: { 'react-native': 'workspace:*' },
      devDependencies: {
        '@react-native-community/cli': '^19.0.0',
        metro: '*',
        'metro-config': '*',
      },
    });

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('ambiguous');
    expect(result.manualGuidance).toEqual(
      expect.arrayContaining([
        expect.stringContaining('react-native declaration "workspace:*"'),
        expect.stringContaining('metro declaration "*"'),
        expect.stringContaining('metro-config declaration "*"'),
      ])
    );
  });

  it('rejects an unresolved broad Module Federation declaration', () => {
    writePackageJson({
      devDependencies: {
        '@module-federation/metro': 'workspace:*',
        '@react-native-community/cli': '^19.0.0',
      },
    });

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('ambiguous');
    expect(result.manualGuidance[0]).toContain(
      '@module-federation/metro declaration "workspace:*"'
    );
  });

  it('accepts a compatible resolved Module Federation workspace declaration', () => {
    writePackageJson({
      devDependencies: {
        '@module-federation/metro': 'workspace:*',
        '@react-native-community/cli': '^19.0.0',
      },
    });
    writeResolvedPackage('@module-federation/metro', '2.9.1');

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('react-native-cli');
  });

  it('accepts compatible resolved versions for workspace declarations', () => {
    writePackageJson({
      dependencies: { 'react-native': 'workspace:*' },
      devDependencies: {
        '@react-native-community/cli': '^19.0.0',
        metro: 'workspace:*',
      },
    });
    for (const [packageName, version] of [
      ['react-native', '0.79.2'],
      ['metro', '0.82.2'],
    ]) {
      writeResolvedPackage(packageName, version);
    }

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('react-native-cli');
    expect(result.createdFiles).toEqual(['react-native.config.js']);
  });

  it('rejects incompatible declarations despite compatible resolved versions', () => {
    writePackageJson({
      devDependencies: {
        '@module-federation/metro': '^3.0.0',
        '@react-native-community/cli': '^19.0.0',
        metro: '^0.83.0',
      },
    });
    writeResolvedPackage('@module-federation/metro', '2.9.1');
    writeResolvedPackage('metro', '0.82.2');

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('ambiguous');
    expect(result.manualGuidance).toEqual(
      expect.arrayContaining([
        expect.stringContaining('@module-federation/metro declaration "^3.0.0"'),
        expect.stringContaining('metro declaration "^0.83.0"'),
      ])
    );
  });

  it('resolves Metro peers through the React Native Metro config dependency graph', () => {
    writePackageJson({
      devDependencies: {
        '@react-native-community/cli': '^19.0.0',
        '@react-native/metro-config': '^0.79.0',
      },
    });
    const packageJsonPath = path.join(tempDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    for (const packageName of [
      '@babel/types',
      'metro',
      'metro-config',
      'metro-file-map',
      'metro-resolver',
      'metro-source-map',
    ]) {
      delete packageJson.devDependencies[packageName];
    }
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson));

    const reactNativeMetroConfigDirectory = writeResolvedPackage(
      '@react-native/metro-config',
      '0.79.0'
    );
    const metroConfigDirectory = writeResolvedPackage(
      'metro-config',
      '0.82.1',
      reactNativeMetroConfigDirectory
    );
    const metroDirectory = writeResolvedPackage('metro', '0.82.1', metroConfigDirectory);
    for (const packageName of [
      '@babel/types',
      'metro-file-map',
      'metro-resolver',
      'metro-source-map',
    ]) {
      writeResolvedPackage(
        packageName,
        packageName === '@babel/types' ? '7.25.0' : '0.82.1',
        metroDirectory
      );
    }

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('react-native-cli');
    expect(result.createdFiles).toEqual(['react-native.config.js']);
  });

  it('rejects incompatible React Native and Metro versions', () => {
    writePackageJson({
      dependencies: { 'react-native': '^0.78.0' },
      devDependencies: {
        '@react-native-community/cli': '^19.0.0',
        metro: '^0.81.0',
      },
    });

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('ambiguous');
    expect(result.manualGuidance).toEqual(
      expect.arrayContaining([
        expect.stringContaining('react-native declaration "^0.78.0"'),
        expect.stringContaining('metro declaration "^0.81.0"'),
      ])
    );
  });

  it('rejects missing or incompatible Metro peer packages', () => {
    writePackageJson({
      dependencies: { react: '^18.0.0' },
      devDependencies: {
        '@react-native-community/cli': '^19.0.0',
        'metro-file-map': '^0.83.0',
      },
    });
    const packageJsonPath = path.join(tempDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    delete packageJson.devDependencies['metro-resolver'];
    delete packageJson.devDependencies['@babel/types'];
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson));

    const result = bootstrapMetroCommands(tempDir);

    expect(result.integration).toBe('ambiguous');
    expect(result.manualGuidance).toEqual(
      expect.arrayContaining([
        expect.stringContaining('@babel/types could not be resolved'),
        expect.stringContaining('react declaration "^18.0.0"'),
        expect.stringContaining('metro-file-map declaration "^0.83.0"'),
        expect.stringContaining('metro-resolver could not be resolved'),
      ])
    );
    expect(fs.existsSync(path.join(tempDir, 'react-native.config.js'))).toBe(false);
  });

  it('uses Android when it is the only direct CLI platform package', () => {
    writePackageJson({
      devDependencies: {
        '@react-native-community/cli': '^19.0.0',
        '@react-native-community/cli-platform-android': '^19.0.0',
      },
    });
    fs.writeFileSync(
      path.join(tempDir, 'metro.config.js'),
      'module.exports = { resolver: {} };\n'
    );

    const result = bootstrapMetroCommands(tempDir);

    expect(result.platformArgument).toBe('android');
    expect(result.manualGuidance).toContain(
      'Publish with --platform android after registration.'
    );
  });
});
