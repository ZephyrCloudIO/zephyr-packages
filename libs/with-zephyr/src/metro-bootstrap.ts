import fs from 'fs';
import path from 'path';
import {
  hasExportedConfigCall,
  rewriteWithAstGrep,
  searchWithAstGrep,
} from './engine/ast-grep.js';
import type { PackageRequirement } from './nextjs-vinext.js';
import {
  getDeclaredPackageVersion,
  getResolvedPackageVersion,
  isSafelyConstrainedVersion,
  isVersionCompatible,
} from './package-manager.js';

type MetroIntegration = 'react-native-cli' | 'rnef' | 'ambiguous' | 'none';

export interface MetroBootstrapResult {
  integration: MetroIntegration;
  platformArgument: string;
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
const METRO_CONFIG_FILES = [
  'metro.config.js',
  'metro.config.ts',
  'metro.config.mjs',
  'metro.config.cjs',
];
const MODULE_FEDERATION_METRO_VERSION = '^2.9.0';
const ZEPHYR_METRO_PLUGIN_VERSION = '^1.4.0';
const METRO_PEER_PACKAGES = [
  'metro',
  'metro-config',
  'metro-file-map',
  'metro-resolver',
  'metro-source-map',
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

function getPlatformArgument(packageJson: Record<string, any>): string {
  const hasAndroid = hasAnyPackage(packageJson, [
    '@react-native-community/cli-platform-android',
  ]);
  const hasIos = hasAnyPackage(packageJson, ['@react-native-community/cli-platform-ios']);
  return hasAndroid !== hasIos ? (hasAndroid ? 'android' : 'ios') : '<platform>';
}

function getManualGuidance(packageJson: Record<string, any>): string[] {
  return [
    'No React Native command config was changed because the integration could not be updated safely.',
    'React Native CLI: export commands: [...(config.commands ?? []), ...zephyrMetroReactNativeCli().commands] from the active react-native.config.* file and import zephyrMetroReactNativeCli from zephyr-metro-plugin.',
    'RNEF: add zephyrMetroRNEFPlugin() to the exported plugins array in the active rnef.config.* file and import zephyrMetroRNEFPlugin from zephyr-metro-plugin.',
    `Publish with --platform ${getPlatformArgument(packageJson)} after registration.`,
  ];
}

function getVersionProblem(
  directory: string,
  packageName: string,
  minimumVersion: string,
  options: { allowMissing?: boolean; maximumVersionExclusive?: string } = {}
): string | undefined {
  const expectedVersion = options.maximumVersionExclusive
    ? `${minimumVersion} or newer but below ${options.maximumVersionExclusive}`
    : `${minimumVersion} or newer`;
  const resolvedVersion = getResolvedPackageVersion(packageName, directory);
  if (resolvedVersion) {
    return isVersionCompatible(
      resolvedVersion,
      minimumVersion,
      options.maximumVersionExclusive
    )
      ? undefined
      : `${packageName} ${resolvedVersion} is installed, but ${expectedVersion} is required.`;
  }

  const declaration = getDeclaredPackageVersion(packageName, directory);
  if (!declaration) {
    if (options.allowMissing) return undefined;
    return `${packageName} could not be resolved and has no direct version declaration.`;
  }
  return isSafelyConstrainedVersion(
    declaration,
    minimumVersion,
    options.maximumVersionExclusive
  )
    ? undefined
    : `${packageName} declaration "${declaration}" could not be verified as ${expectedVersion}.`;
}

function hasModuleFederationSetup(filePath: string): boolean {
  const content = fs.readFileSync(filePath, 'utf8');
  const importsWithModuleFederation =
    /^\s*import\s*\{[^}]*\bwithModuleFederation\b[^}]*\}\s*from\s*["']@module-federation\/metro["']/m.test(
      content
    ) ||
    /^\s*(?:const|let|var)\s*\{[^}]*\bwithModuleFederation\b[^}]*\}\s*=\s*require\(\s*["']@module-federation\/metro["']\s*\)/m.test(
      content
    );
  return (
    importsWithModuleFederation &&
    searchWithAstGrep({ filePath, pattern: 'withModuleFederation($$$ARGS)' }).status ===
      'match'
  );
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

function hasExportedHelperCall(
  filePath: string,
  content: string,
  importName: string,
  propertyName: 'commands' | 'plugins'
): boolean {
  const localName = findImportedHelperName(content, importName);
  return [importName, localName]
    .filter((name): name is string => Boolean(name))
    .some((name) => {
      if (name.startsWith('$')) return false;
      return hasExportedConfigCall({
        filePath,
        pattern: `${name}($$$ARGS)`,
        propertyName,
        allowDirectExport: propertyName === 'commands',
      });
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
  if (hasExportedHelperCall(filePath, content, importName, propertyName)) {
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
  if (hasExportedHelperCall(filePath, content, importName, propertyName)) {
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
  options: { dryRun?: boolean; metroConfigFilePaths?: string[] } = {}
): MetroBootstrapResult {
  const dryRun = options.dryRun ?? false;
  const result: MetroBootstrapResult = {
    integration: 'none',
    platformArgument: '<platform>',
    createdFiles: [],
    updatedFiles: [],
    packageRequirements: [],
    manualGuidance: [],
  };
  const packageJson = readPackageJson(directory);
  if (!packageJson) {
    result.integration = 'ambiguous';
    result.manualGuidance = [
      'No package.json was found for this Metro project, so publication commands were not registered.',
    ];
    return result;
  }
  result.platformArgument = getPlatformArgument(packageJson);

  const metroConfigFilePaths =
    options.metroConfigFilePaths ??
    METRO_CONFIG_FILES.map((fileName) => path.join(directory, fileName)).filter(
      (filePath) => fs.existsSync(filePath)
    );
  if (
    metroConfigFilePaths.length !== 1 ||
    !hasModuleFederationSetup(metroConfigFilePaths[0]!)
  ) {
    const configDescription =
      metroConfigFilePaths.length === 1
        ? path.basename(metroConfigFilePaths[0]!)
        : 'The active Metro config';
    result.integration = 'ambiguous';
    result.manualGuidance = [
      `${configDescription} is not verifiably configured with @module-federation/metro using withModuleFederation(). Companion command config was left unchanged; configure Module Federation first, then rerun with-zephyr.`,
      ...getManualGuidance(packageJson),
    ];
    return result;
  }

  const versionProblems = [
    getVersionProblem(directory, '@module-federation/metro', '2.9.0', {
      allowMissing: true,
      maximumVersionExclusive: '3.0.0',
    }),
    getVersionProblem(directory, '@babel/types', '7.25.0', {
      maximumVersionExclusive: '8.0.0',
    }),
    getVersionProblem(directory, 'react', '19.0.0'),
    getVersionProblem(directory, 'react-native', '0.79.0'),
    ...METRO_PEER_PACKAGES.map((packageName) =>
      getVersionProblem(directory, packageName, '0.82.1', {
        maximumVersionExclusive: '0.83.0',
      })
    ),
  ].filter((problem): problem is string => Boolean(problem));
  if (versionProblems.length > 0) {
    result.integration = 'ambiguous';
    result.manualGuidance = [...versionProblems, ...getManualGuidance(packageJson)];
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
    result.manualGuidance = getManualGuidance(packageJson);
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
    result.manualGuidance = getManualGuidance(packageJson);
    return result;
  }

  result.integration = integration;
  const setPackageRequirements = () => {
    result.packageRequirements = [
      {
        name: 'zephyr-metro-plugin',
        isDev: true,
        version: ZEPHYR_METRO_PLUGIN_VERSION,
        projectDirectory: directory,
      },
      {
        name: '@module-federation/metro',
        isDev: true,
        version: MODULE_FEDERATION_METRO_VERSION,
        projectDirectory: directory,
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
        ...getManualGuidance(packageJson),
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
      ...getManualGuidance(packageJson),
    ];
  } else {
    setPackageRequirements();
  }
  return result;
}
