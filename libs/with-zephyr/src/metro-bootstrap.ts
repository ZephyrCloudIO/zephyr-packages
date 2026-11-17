import fs from 'fs';
import path from 'path';
import {
  applyEdits,
  isCallTo,
  isFunction,
  isIdentifier,
  isKeyValueProperty,
  isModuleExports,
  isModuleExportsAssignment,
  parseSource,
  type AstNode,
  type ParsedSource,
} from './engine/ast.js';
import type { PackageRequirement } from './nextjs-vinext.js';
import {
  getDeclaredPackageVersion,
  getResolvedPackageDirectory,
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
  options: {
    allowMissing?: boolean;
    allowUnresolvedManagedDeclaration?: boolean;
    maximumVersionExclusive?: string;
    resolutionDirectories?: string[];
  } = {}
): string | undefined {
  const expectedVersion = options.maximumVersionExclusive
    ? `${minimumVersion} or newer but below ${options.maximumVersionExclusive}`
    : `${minimumVersion} or newer`;
  const declaration = getDeclaredPackageVersion(packageName, directory);
  const usesWorkspaceProtocol = /^(?:catalog:|workspace:)/.test(declaration ?? '');
  if (
    declaration &&
    !usesWorkspaceProtocol &&
    !isSafelyConstrainedVersion(
      declaration,
      minimumVersion,
      options.maximumVersionExclusive
    )
  ) {
    return `${packageName} declaration "${declaration}" could not be verified as ${expectedVersion}.`;
  }

  const resolvedVersion = [directory, ...(options.resolutionDirectories ?? [])]
    .map((resolutionDirectory) =>
      getResolvedPackageVersion(packageName, resolutionDirectory)
    )
    .find((version): version is string => Boolean(version));
  if (resolvedVersion) {
    return isVersionCompatible(
      resolvedVersion,
      minimumVersion,
      options.maximumVersionExclusive
    )
      ? undefined
      : `${packageName} ${resolvedVersion} is installed, but ${expectedVersion} is required.`;
  }

  if (usesWorkspaceProtocol && options.allowUnresolvedManagedDeclaration) {
    return undefined;
  }

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

function getUniqueBindingName(content: string, bindingName: string): string {
  let candidate = bindingName;
  let suffix = 2;
  while (new RegExp(`\\b${candidate}\\b`).test(content)) {
    candidate = `${bindingName}${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function getMetroResolutionDirectories(directory: string): string[] {
  const reactNativeMetroConfigDirectory = getResolvedPackageDirectory(
    '@react-native/metro-config',
    directory
  );
  if (!reactNativeMetroConfigDirectory) return [];

  const metroConfigDirectory = getResolvedPackageDirectory(
    'metro-config',
    reactNativeMetroConfigDirectory
  );
  const metroDirectory = getResolvedPackageDirectory(
    'metro',
    metroConfigDirectory ?? reactNativeMetroConfigDirectory
  );
  return [reactNativeMetroConfigDirectory, metroConfigDirectory, metroDirectory].filter(
    (value): value is string => Boolean(value)
  );
}

function tryParse(filePath: string, content: string): ParsedSource | undefined {
  try {
    return parseSource(content, filePath);
  } catch {
    return undefined;
  }
}

function hasModuleFederationSetup(filePath: string): boolean {
  const content = fs.readFileSync(filePath, 'utf8');
  if ((content.match(/module\.exports\s*=/g)?.length ?? 0) > 1) {
    return false;
  }
  const parsed = tryParse(filePath, content);
  if (!parsed) return false;
  const localName = findImportedHelperExpression(
    parsed,
    '@module-federation/metro',
    'withModuleFederation'
  );
  return Boolean(
    localName &&
    hasExportedConfigCall(parsed, { callee: localName, allowDirectExport: true })
  );
}

interface ExportedConfigCallOptions {
  /**
   * Identifier or dotted path of the helper, e.g. `withModuleFederation` or
   * `mf.withModuleFederation`.
   */
  callee: string;
  propertyName?: 'commands' | 'plugins';
  allowDirectExport?: boolean;
}

/**
 * Whether a call to `callee` reaches the module's exported config: exported directly
 * (possibly through wrapping calls, a top-level exported binding, or a returned local),
 * or registered in the exported object's `commands` / `plugins` property.
 */
function hasExportedConfigCall(
  parsed: ParsedSource,
  options: ExportedConfigCallOptions
): boolean {
  const program = parsed.program;
  const calls = parsed
    .ofType('CallExpression')
    .filter((call) => isCallTo(call, options.callee));
  const exportedIdentifiers = new Set<string>();
  for (const node of parsed.nodes) {
    const exported =
      node.type === 'ExportDefaultDeclaration'
        ? node.declaration
        : isModuleExportsAssignment(node)
          ? node.right
          : undefined;
    if (isIdentifier(exported)) exportedIdentifiers.add(exported.name);
  }

  const declaredName = (declarator: AstNode): string | undefined =>
    isIdentifier(declarator.id) ? declarator.id.name : undefined;

  const isTopLevelDeclaration = (declarator: AstNode): boolean => {
    const container = parsed.parent(parsed.parent(declarator)!);
    return Boolean(
      container === program ||
      (container?.type === 'ExportNamedDeclaration' &&
        parsed.parent(container) === program)
    );
  };

  const isExportedValue = (value: AstNode, parent: AstNode | null): boolean =>
    Boolean(
      (isModuleExportsAssignment(parent) && parent!.right === value) ||
      (parent?.type === 'ExportDefaultDeclaration' && parent.declaration === value)
    );

  const isExportedObject = (object: AstNode | null): boolean => {
    if (object?.type !== 'ObjectExpression') return false;
    const parent = parsed.parent(object);
    if (isExportedValue(object, parent)) return true;
    if (parent?.type !== 'VariableDeclarator' || !isTopLevelDeclaration(parent))
      return false;
    const identifier = declaredName(parent);
    return Boolean(identifier && exportedIdentifiers.has(identifier));
  };

  const references = (name: string) =>
    parsed
      .ofType('Identifier')
      .filter((identifier) => identifier.name === name && parsed.isReference(identifier));

  const isReturnedFromFunction = (bindingName: string, functionNode: AstNode): boolean =>
    references(bindingName).some((identifier) => {
      for (
        let ancestor = parsed.parent(identifier);
        ancestor && ancestor !== functionNode;
        ancestor = parsed.parent(ancestor)
      ) {
        if (isFunction(ancestor)) return false;
        if (ancestor.type === 'ReturnStatement') return true;
      }
      return false;
    });

  const isDirectlyExportedExpression = (call: AstNode): boolean => {
    let expression = call;
    let parent = parsed.parent(expression);
    while (parent) {
      if (isExportedValue(expression, parent)) return true;

      if (parent.type === 'VariableDeclarator') {
        const identifier = declaredName(parent);
        if (!identifier || parent.init !== expression) return false;
        if (isTopLevelDeclaration(parent) && exportedIdentifiers.has(identifier)) {
          return true;
        }

        const functionNode = parsed
          .ancestors(parent)
          .find(
            (ancestor) =>
              ancestor.type === 'ArrowFunctionExpression' ||
              ancestor.type === 'FunctionExpression'
          );
        return Boolean(
          functionNode &&
          isReturnedFromFunction(identifier, functionNode) &&
          isDirectlyExportedExpression(functionNode)
        );
      }

      if (
        parent.type !== 'CallExpression' &&
        parent.type !== 'ParenthesizedExpression' &&
        parent.type !== 'AwaitExpression'
      ) {
        return false;
      }
      expression = parent;
      parent = parsed.parent(parent);
    }
    return false;
  };

  const isRegisteredInExportedProperty = (value: AstNode): boolean => {
    const property = parsed
      .ancestors(value)
      .find((ancestor) => isKeyValueProperty(ancestor, options.propertyName));
    if (!property || !isExportedObject(parsed.parent(property))) return false;

    const container = parsed.parent(value);
    if (options.propertyName === 'plugins') {
      return Boolean(
        container?.type === 'ArrayExpression' && property.value === container
      );
    }

    if (property.value === value) return true;
    const array = container && parsed.parent(container);
    return Boolean(
      container?.type === 'SpreadElement' &&
      array?.type === 'ArrayExpression' &&
      property.value === array
    );
  };

  const isCommandsMember = (node: AstNode | null, object?: AstNode): boolean =>
    Boolean(
      node?.type === 'MemberExpression' &&
      !node.computed &&
      isIdentifier(node.property, 'commands') &&
      (object === undefined || node.object === object)
    );

  return calls.some((call) => {
    if (options.allowDirectExport && isDirectlyExportedExpression(call)) {
      return true;
    }

    if (!options.propertyName) return false;

    if (options.propertyName === 'plugins') {
      if (isRegisteredInExportedProperty(call)) return true;
    } else {
      const member = parsed.parent(call);
      if (isCommandsMember(member, call) && isRegisteredInExportedProperty(member!)) {
        return true;
      }
    }

    const declaration = parsed.parent(call);
    if (declaration?.type !== 'VariableDeclarator' || declaration.init !== call)
      return false;
    if (!isTopLevelDeclaration(declaration)) return false;
    const bindingName = declaredName(declaration);
    if (!bindingName) return false;

    if (options.propertyName === 'commands') {
      return parsed
        .ofType('MemberExpression')
        .filter(
          (member) => isIdentifier(member.object, bindingName) && isCommandsMember(member)
        )
        .some(isRegisteredInExportedProperty);
    }
    return references(bindingName).some(isRegisteredInExportedProperty);
  });
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

function findImportedHelperExpression(
  parsed: ParsedSource,
  packageName: string,
  importName: string
): string | undefined {
  const content = parsed.source;
  // The regexes below locate candidates; only real top-level statements count.
  const topLevelStarts = new Set(
    (parsed.program.body as AstNode[]).map((statement) => statement.start)
  );
  const escapedPackageName = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const importPatterns = [
    new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${escapedPackageName}["']`, 'g'),
    new RegExp(
      `(?:const|let|var)\\s*\\{([^}]*)\\}\\s*=\\s*require\\(\\s*["']${escapedPackageName}["']\\s*\\)`,
      'g'
    ),
  ];

  for (const pattern of importPatterns) {
    for (const match of content.matchAll(pattern)) {
      if (!match[0] || !topLevelStarts.has(match.index)) {
        continue;
      }
      const specifiers = match[1]?.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      for (const specifier of specifiers?.split(',') ?? []) {
        const parts = specifier.trim().split(/\s+(?:as\s+)?|\s*:\s*/);
        if (parts[0] === importName) {
          return parts[1] ?? importName;
        }
      }
    }
  }

  const namespacePatterns = [
    new RegExp(
      `import\\s*\\*\\s*as\\s*([A-Za-z_$][\\w$]*)\\s*from\\s*["']${escapedPackageName}["']`,
      'g'
    ),
    new RegExp(
      `(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*require\\(\\s*["']${escapedPackageName}["']\\s*\\)`,
      'g'
    ),
  ];
  for (const pattern of namespacePatterns) {
    for (const match of content.matchAll(pattern)) {
      const namespace = match[1];
      if (namespace && match[0] && topLevelStarts.has(match.index)) {
        return `${namespace}.${importName}`;
      }
    }
  }

  return undefined;
}

function hasExportedHelperCall(
  parsed: ParsedSource,
  importName: string,
  propertyName: 'commands' | 'plugins'
): boolean {
  const localName = findImportedHelperExpression(
    parsed,
    'zephyr-metro-plugin',
    importName
  );
  return [localName]
    .filter((name): name is string => Boolean(name))
    .some((name) => {
      if (name.startsWith('$')) return false;
      return hasExportedConfigCall(parsed, {
        callee: name,
        propertyName,
        allowDirectExport: propertyName === 'commands',
      });
    });
}

function addImport(
  filePath: string,
  content: string,
  importName: string,
  localName: string,
  esm: boolean
): string {
  const parsed = tryParse(filePath, content);
  if (parsed && findImportedHelperExpression(parsed, 'zephyr-metro-plugin', importName)) {
    return content;
  }

  const declaration = esm
    ? `import { ${importName}${localName === importName ? '' : ` as ${localName}`} } from "zephyr-metro-plugin";\n`
    : `const { ${importName}${localName === importName ? '' : `: ${localName}`} } = require("zephyr-metro-plugin");\n`;
  let insertionIndex = content.startsWith('#!') ? content.indexOf('\n') + 1 : 0;
  if (insertionIndex === 0 && content.startsWith('#!')) {
    return `${content}\n${declaration}`;
  }
  const directivePrologue =
    /^(?:(?:[ \t]*(?:"[^"\r\n]*"|'[^'\r\n]*')[ \t]*;?[ \t]*(?:(?:\/\/[^\r\n]*)|(?:\/\*[\s\S]*?\*\/[ \t]*))?(?:\r?\n|$))|(?:[ \t]*\/\/[^\r\n]*(?:\r?\n|$))|(?:[ \t]*\/\*[\s\S]*?\*\/[ \t]*(?:\r?\n|$))|(?:[ \t]*\r?\n))+/.exec(
      content.slice(insertionIndex)
    );
  insertionIndex += directivePrologue?.[0].length ?? 0;
  return `${content.slice(0, insertionIndex)}${declaration}${content.slice(insertionIndex)}`;
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
  if ((content.match(/module\.exports\s*=/g)?.length ?? 0) !== 1) {
    return 'unsupported';
  }
  const parsed = tryParse(filePath, content);
  if (!parsed) return 'unsupported';
  if (hasExportedHelperCall(parsed, importName, propertyName)) {
    return 'already-configured';
  }
  const localName =
    findImportedHelperExpression(parsed, 'zephyr-metro-plugin', importName) ??
    getUniqueBindingName(content, importName);
  bindingName = getUniqueBindingName(content, bindingName);
  const exportsObject = parsed
    .ofType('AssignmentExpression')
    .some(
      (assignment) =>
        isModuleExports(assignment.left) &&
        assignment.operator === '=' &&
        assignment.right.type === 'ObjectExpression'
    );
  if (!exportsObject) {
    return 'unsupported';
  }

  const nextContent = `${addImport(filePath, content, importName, localName, false).trimEnd()}

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
  const parsed = tryParse(filePath, content);
  if (!parsed) return 'unsupported';
  if (hasExportedHelperCall(parsed, importName, propertyName)) {
    return 'already-configured';
  }
  const localName =
    findImportedHelperExpression(parsed, 'zephyr-metro-plugin', importName) ??
    getUniqueBindingName(content, importName);
  bindingName = getUniqueBindingName(content, bindingName);

  const exports = parsed
    .ofType('ExportDefaultDeclaration')
    .filter((statement) => statement.declaration.type === 'ObjectExpression');
  if (exports.length === 0) {
    return 'unsupported';
  }
  const nextContent = applyEdits(
    content,
    exports.map((statement) => ({
      start: statement.start,
      end: statement.end,
      text: `const ${bindingName} = ${parsed.text(statement.declaration)};
export default {
  ...${bindingName},
  ${propertyName}: [
    ...(${bindingName}.${propertyName} ?? []),
    ${integrationExpression.replace(importName, localName)},
  ],
};`,
    }))
  );

  if (!dryRun) {
    fs.writeFileSync(
      filePath,
      addImport(filePath, nextContent, importName, localName, true)
    );
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

  const metroResolutionDirectories = getMetroResolutionDirectories(directory);
  const versionProblems = [
    getVersionProblem(directory, '@module-federation/metro', '2.9.0', {
      allowMissing: true,
      allowUnresolvedManagedDeclaration: true,
      maximumVersionExclusive: '3.0.0',
    }),
    getVersionProblem(directory, '@babel/types', '7.25.0', {
      maximumVersionExclusive: '8.0.0',
      resolutionDirectories: metroResolutionDirectories,
    }),
    getVersionProblem(directory, 'react', '19.0.0'),
    getVersionProblem(directory, 'react-native', '0.79.0'),
    ...METRO_PEER_PACKAGES.map((packageName) =>
      getVersionProblem(directory, packageName, '0.82.1', {
        maximumVersionExclusive: '0.83.0',
        resolutionDirectories: metroResolutionDirectories,
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
  const isDevRequirement = (packageName: string) =>
    !Object.prototype.hasOwnProperty.call(packageJson['dependencies'] ?? {}, packageName);
  const setPackageRequirements = () => {
    result.packageRequirements = [
      {
        name: 'zephyr-metro-plugin',
        isDev: isDevRequirement('zephyr-metro-plugin'),
        version: ZEPHYR_METRO_PLUGIN_VERSION,
        projectDirectory: directory,
        requireResolved: true,
      },
      {
        name: '@module-federation/metro',
        isDev: isDevRequirement('@module-federation/metro'),
        version: MODULE_FEDERATION_METRO_VERSION,
        projectDirectory: directory,
        requireResolved: true,
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
