import fs from 'fs';
import path from 'path';
import { rewriteWithAstGrep, searchWithAstGrep } from './engine/ast-grep.js';
import type { PackageRequirement } from './nextjs-vinext.js';

type MetroIntegration = 'react-native-cli' | 'rnef' | 'ambiguous' | 'none';

export interface MetroBootstrapResult {
  integration: MetroIntegration;
  createdFiles: string[];
  updatedFiles: string[];
  packageRequirements: PackageRequirement[];
  manualGuidance: string[];
}

const REACT_NATIVE_CLI_PACKAGES = [
  '@react-native-community/cli',
  '@react-native-community/cli-platform-android',
  '@react-native-community/cli-platform-ios',
];
const RNEF_PACKAGES = ['@rnef/cli', '@rnef/config'];
const REACT_NATIVE_CONFIG_FILES = [
  'react-native.config.js',
  'react-native.config.cjs',
  'react-native.config.ts',
  'react-native.config.mjs',
];
const RNEF_CONFIG_FILES = ['rnef.config.js', 'rnef.config.ts', 'rnef.config.mjs'];
const MODULE_FEDERATION_METRO_VERSION = '^2.9.0';

const MANUAL_GUIDANCE = [
  'No React Native command config was changed because the integration could not be updated safely.',
  'React Native CLI: export commands: [...(config.commands ?? []), ...zephyrMetroReactNativeCli().commands] from react-native.config.js and import zephyrMetroReactNativeCli from zephyr-metro-plugin.',
  'RNEF: add zephyrMetroRNEFPlugin() to the exported plugins array in rnef.config.* and import zephyrMetroRNEFPlugin from zephyr-metro-plugin.',
];

type ConfigUpdateResult = 'updated' | 'already-configured' | 'unsupported';

function readPackageJson(directory: string): Record<string, any> | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  } catch {
    return undefined;
  }
}

function hasAnyPackage(packageJson: Record<string, any>, names: string[]): boolean {
  const packages = {
    ...packageJson['dependencies'],
    ...packageJson['devDependencies'],
  };
  return names.some((name) => Boolean(packages[name]));
}

function getPackageVersion(
  packageJson: Record<string, any>,
  packageName: string
): string | undefined {
  return (
    packageJson['dependencies']?.[packageName] ??
    packageJson['devDependencies']?.[packageName]
  );
}

function supportsMetroCommands(version: string): boolean {
  const match = version.match(/(\d+)\.(\d+)/);
  return Boolean(match && Number(match[1]) === 2 && Number(match[2]) >= 9);
}

function discoverConfigFiles(
  directory: string,
  prefix: string,
  supportedFiles: string[]
): { supported: string[]; unsupported: string[] } {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(prefix))
    .map((entry) => entry.name);
  return {
    supported: supportedFiles.filter((fileName) => candidates.includes(fileName)),
    unsupported: candidates.filter((fileName) => !supportedFiles.includes(fileName)),
  };
}

function findImportedHelperName(content: string, importName: string): string | undefined {
  const importPatterns = [
    /import\s*\{([^}]*)\}\s*from\s*["']zephyr-metro-plugin["']/g,
    /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*require\(["']zephyr-metro-plugin["']\)/g,
  ];

  for (const pattern of importPatterns) {
    for (const match of content.matchAll(pattern)) {
      const specifiers = match[1]?.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      for (const specifier of specifiers?.split(',') ?? []) {
        const parts = specifier.trim().split(/\s+(?:as\s+)?|\s*:\s*/);
        if (parts[0] === importName) {
          return parts[1] ?? importName;
        }
      }
    }
  }

  return undefined;
}

function hasHelperCall(filePath: string, content: string, importName: string): boolean {
  const localName = findImportedHelperName(content, importName);
  return [importName, localName]
    .filter((name): name is string => Boolean(name))
    .some((name) => {
      if (name.startsWith('$')) {
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(?:^|[^$\\w])${escapedName}\\s*\\(`, 'm').test(content);
      }
      return (
        searchWithAstGrep({ filePath, pattern: `${name}($$$ARGS)` }).status === 'match'
      );
    });
}

function addImport(content: string, importName: string, esm: boolean): string {
  if (findImportedHelperName(content, importName)) {
    return content;
  }

  const declaration = esm
    ? `import { ${importName} } from "zephyr-metro-plugin";\n`
    : `const { ${importName} } = require("zephyr-metro-plugin");\n`;
  return `${declaration}${content}`;
}

function updateCommonJsConfig(
  filePath: string,
  importName: string,
  bindingName: string,
  propertyName: 'commands' | 'plugins',
  integrationExpression: string,
  dryRun: boolean
): ConfigUpdateResult {
  const content = fs.readFileSync(filePath, 'utf8');
  if (hasHelperCall(filePath, content, importName)) {
    return 'already-configured';
  }
  const localName = findImportedHelperName(content, importName) ?? importName;
  if (
    (content.match(/module\.exports\s*=/g)?.length ?? 0) !== 1 ||
    searchWithAstGrep({
      filePath,
      pattern: 'module.exports = {$$$PROPS}',
    }).status !== 'match'
  ) {
    return 'unsupported';
  }

  const nextContent = `${addImport(content, importName, false).trimEnd()}

const ${bindingName} = module.exports;
module.exports = {
  ...${bindingName},
  ${propertyName}: [
    ...(${bindingName}.${propertyName} ?? []),
    ${integrationExpression.replace(importName, localName)},
  ],
};
`;
  if (!dryRun) {
    fs.writeFileSync(filePath, nextContent);
  }
  return 'updated';
}

function updateEsmConfig(
  filePath: string,
  importName: string,
  bindingName: string,
  propertyName: 'commands' | 'plugins',
  integrationExpression: string,
  dryRun: boolean
): ConfigUpdateResult {
  const content = fs.readFileSync(filePath, 'utf8');
  if (hasHelperCall(filePath, content, importName)) {
    return 'already-configured';
  }
  const localName = findImportedHelperName(content, importName) ?? importName;

  const result = rewriteWithAstGrep({
    filePath,
    pattern: 'export default {$$$PROPS}',
    rewrite: `const ${bindingName} = {$$$PROPS};
export default {
  ...${bindingName},
  ${propertyName}: [
    ...(${bindingName}.${propertyName} ?? []),
    ${integrationExpression.replace(importName, localName)},
  ],
}`,
    updateAll: !dryRun,
  });
  if (result.status !== 'match') {
    return 'unsupported';
  }

  if (!dryRun) {
    const updatedContent = fs.readFileSync(filePath, 'utf8');
    fs.writeFileSync(filePath, addImport(updatedContent, importName, true));
  }
  return 'updated';
}

function updateConfig(
  filePath: string,
  importName: string,
  bindingName: string,
  propertyName: 'commands' | 'plugins',
  integrationExpression: string,
  dryRun: boolean
): ConfigUpdateResult {
  const content = fs.readFileSync(filePath, 'utf8');
  const esm = /(^|\n)\s*(import\s|export\s)/.test(content);
  return esm
    ? updateEsmConfig(
        filePath,
        importName,
        bindingName,
        propertyName,
        integrationExpression,
        dryRun
      )
    : updateCommonJsConfig(
        filePath,
        importName,
        bindingName,
        propertyName,
        integrationExpression,
        dryRun
      );
}

export function bootstrapMetroCommands(
  directory: string,
  options: { dryRun?: boolean } = {}
): MetroBootstrapResult {
  const dryRun = options.dryRun ?? false;
  const result: MetroBootstrapResult = {
    integration: 'none',
    createdFiles: [],
    updatedFiles: [],
    packageRequirements: [],
    manualGuidance: [],
  };
  const packageJson = readPackageJson(directory);
  if (!packageJson) {
    result.integration = 'ambiguous';
    result.manualGuidance = MANUAL_GUIDANCE;
    return result;
  }

  const installedMetroVersion = getPackageVersion(
    packageJson,
    '@module-federation/metro'
  );
  if (installedMetroVersion && !supportsMetroCommands(installedMetroVersion)) {
    result.integration = 'ambiguous';
    result.manualGuidance = [
      `Installed @module-federation/metro version ${installedMetroVersion} is not supported by the publication adapter. Use ${MODULE_FEDERATION_METRO_VERSION}.`,
      ...MANUAL_GUIDANCE,
    ];
    return result;
  }

  const reactNativeConfigs = discoverConfigFiles(
    directory,
    'react-native.config',
    REACT_NATIVE_CONFIG_FILES
  );
  const rnefConfigs = discoverConfigFiles(directory, 'rnef.config', RNEF_CONFIG_FILES);
  const hasReactNativeCliPackage = hasAnyPackage(packageJson, REACT_NATIVE_CLI_PACKAGES);
  const hasRnefPackage = hasAnyPackage(packageJson, RNEF_PACKAGES);
  const hasInvalidCandidates =
    reactNativeConfigs.unsupported.length > 0 ||
    rnefConfigs.unsupported.length > 0 ||
    reactNativeConfigs.supported.length > 1 ||
    rnefConfigs.supported.length > 1;
  const hasConflictingConfigs =
    reactNativeConfigs.supported.length === 1 && rnefConfigs.supported.length === 1;
  const hasReactNativeConfigWithRnefPackage =
    reactNativeConfigs.supported.length === 1 &&
    rnefConfigs.supported.length === 0 &&
    hasRnefPackage;

  if (
    hasInvalidCandidates ||
    hasConflictingConfigs ||
    hasReactNativeConfigWithRnefPackage
  ) {
    result.integration = 'ambiguous';
    result.manualGuidance = MANUAL_GUIDANCE;
    return result;
  }

  const integration =
    rnefConfigs.supported.length === 1 || hasRnefPackage
      ? 'rnef'
      : reactNativeConfigs.supported.length === 1 || hasReactNativeCliPackage
        ? 'react-native-cli'
        : 'ambiguous';
  if (integration === 'ambiguous') {
    result.integration = integration;
    result.manualGuidance = MANUAL_GUIDANCE;
    return result;
  }

  result.integration = integration;
  const setPackageRequirements = () => {
    result.packageRequirements = [
      { name: 'zephyr-metro-plugin', isDev: true },
      {
        name: '@module-federation/metro',
        isDev: true,
        version: MODULE_FEDERATION_METRO_VERSION,
      },
    ];
  };

  if (integration === 'react-native-cli') {
    const reactNativeConfigName = reactNativeConfigs.supported[0];
    const reactNativeConfigPath = path.join(
      directory,
      reactNativeConfigName ?? 'react-native.config.js'
    );
    result.integration = 'react-native-cli';
    if (!reactNativeConfigName) {
      const esm = packageJson['type'] === 'module';
      const content = esm
        ? `import { zephyrMetroReactNativeCli } from "zephyr-metro-plugin";\n\nexport default zephyrMetroReactNativeCli();\n`
        : `const { zephyrMetroReactNativeCli } = require("zephyr-metro-plugin");\n\nmodule.exports = zephyrMetroReactNativeCli();\n`;
      if (!dryRun) {
        fs.writeFileSync(reactNativeConfigPath, content);
      }
      result.createdFiles.push('react-native.config.js');
      setPackageRequirements();
      return result;
    }

    const updateResult = updateConfig(
      reactNativeConfigPath,
      'zephyrMetroReactNativeCli',
      '__zephyrReactNativeConfig',
      'commands',
      '...zephyrMetroReactNativeCli().commands',
      dryRun
    );
    if (updateResult === 'updated') {
      result.updatedFiles.push(reactNativeConfigName);
    }
    if (updateResult === 'unsupported') {
      result.manualGuidance = [
        `${reactNativeConfigName} does not directly export an object and was left unchanged.`,
        ...MANUAL_GUIDANCE,
      ];
    } else {
      setPackageRequirements();
    }
    return result;
  }

  const rnefConfigName =
    rnefConfigs.supported[0] ??
    (packageJson['type'] === 'module' ? 'rnef.config.mjs' : 'rnef.config.js');
  const rnefConfigPath = path.join(directory, rnefConfigName);
  if (rnefConfigs.supported.length === 0) {
    const esm = rnefConfigName.endsWith('.mjs');
    const content = esm
      ? `import { zephyrMetroRNEFPlugin } from "zephyr-metro-plugin";\n\nexport default {\n  plugins: [zephyrMetroRNEFPlugin()],\n};\n`
      : `const { zephyrMetroRNEFPlugin } = require("zephyr-metro-plugin");\n\nmodule.exports = {\n  plugins: [zephyrMetroRNEFPlugin()],\n};\n`;
    if (!dryRun) {
      fs.writeFileSync(rnefConfigPath, content);
    }
    result.createdFiles.push(rnefConfigName);
    setPackageRequirements();
    return result;
  }

  const updateResult = updateConfig(
    rnefConfigPath,
    'zephyrMetroRNEFPlugin',
    '__zephyrRnefConfig',
    'plugins',
    'zephyrMetroRNEFPlugin()',
    dryRun
  );
  if (updateResult === 'updated') {
    result.updatedFiles.push(rnefConfigName);
  }
  if (updateResult === 'unsupported') {
    result.manualGuidance = [
      `${rnefConfigName} does not directly export an object and was left unchanged.`,
      ...MANUAL_GUIDANCE,
    ];
  } else {
    setPackageRequirements();
  }
  return result;
}
