# Common Abstractions for zephyr-agent/zephyr-engine

This document identifies the specific abstractions and components that should be moved to the zephyr-agent/zephyr-engine to eliminate duplication between xpack (webpack/rspack) and rollx (rollup/rolldown/vite) implementations.

## Core Path Utilities

### Description
Currently duplicated in BasePathHandler, ViteBaseHandler, WebpackPathHandler, and UrlConstructor.

### Common Components to Abstract

```typescript
export class PathUtils {
  // Constants
  private static readonly URL_PATTERN = /^(https?:)?\/\//;

  // Path normalization
  static normalizePath(path: string): string;
  
  // Path type detection
  static isAbsolutePath(path: string): boolean;
  static isUrl(path: string): boolean;
  
  // URL construction
  static constructUrl(base: string, path: string): string;
  
  // Extract base path
  static extractBasePathFromUrl(url: string): string;
}
```

## Runtime Detection

### Description
Currently duplicated in RuntimeBasePathDetector and bundler-specific implementations.

### Common Components to Abstract

```typescript
export class RuntimeDetector {
  // Base path detection
  static detectBasePath(): string;
  
  // Framework detection
  static detectFramework(): string;
  
  // Browser/Node environment detection
  static isBrowser(): boolean;
  static isNode(): boolean;
  
  // Client capability detection
  static hasModuleSupport(): boolean;
  static supportsStreaming(): boolean;
}
```

## Schema Validation

### Description
Currently duplicated in MetadataSchema, RemoteTypeConfig, and validation functions.

### Common Components to Abstract

```typescript
export class SchemaValidator {
  // Generic validation
  static validate<T>(data: any, schema: Schema): data is T;
  
  // Version validation
  static isValidVersion(version: string, options?: VersionValidationOptions): boolean;
  
  // Specific validators
  static validateMetadata(metadata: any): boolean;
  static validateRenderType(renderType: string): boolean;
  static validateConfig(config: any, schema: Schema): boolean;
}

export interface Schema {
  required: string[];
  properties: Record<string, {
    type: string;
    enum?: string[];
    pattern?: RegExp;
  }>;
}

export interface VersionValidationOptions {
  allowRange?: boolean;
  allowPrerelease?: boolean;
}
```

## Configuration Normalization

### Description
Currently duplicated in ViteBaseHandler, WebpackPathHandler, and configuration processing.

### Common Components to Abstract

```typescript
export class ConfigNormalizer {
  // Generic options normalization
  static normalizeOptions<T>(options: Partial<T>, defaults: T): T;
  
  // Extract common configuration values
  static extractBasePath(config: any, bundlerType: string): string;
  static extractPublicPath(config: any): string;
  static extractOutputPath(config: any): string;
  
  // Plugin configuration normalization
  static normalizePluginOptions(options: any, defaults: any): any;
}
```

## Manifest Generation and Consumption

### Description
Currently duplicated in BaseHrefIntegration, MetadataPublisher, and MetadataConsumer.

### Common Components to Abstract

```typescript
export class ManifestHandler {
  // Manifest generation
  static createManifest(baseData: any, extensions?: any): any;
  static extendManifest(manifest: any, data: any): any;
  
  // Manifest output
  static writeManifestFile(manifest: any, outputPath: string, filename: string): string;
  
  // Manifest consumption
  static readManifestFile(filePath: string): any;
  static parseManifestContent(content: string): any;
}
```

## Framework and Render Type Detection

### Description
Currently duplicated in FrameworkDetector, RemoteTypeIntegration, and MetadataExtractor.

### Common Components to Abstract

```typescript
export class FeatureDetector {
  // Framework detection
  static detectFramework(dependencies: Record<string, string>): string;
  static getFrameworkInfo(framework: string): FrameworkInfo;
  
  // Render type detection
  static detectRenderType(packageJson: any, config?: any): RenderType;
  static detectFromDependencies(dependencies: Record<string, string>): RenderType;
  static detectFromConfiguration(config: any): RenderType;
  
  // Bundler detection
  static detectBundlerType(config: any): BundlerType;
}

export interface FrameworkInfo {
  defaultRenderType: RenderType;
  version?: string;
  dependencies?: string[];
}

export type RenderType = 'csr' | 'ssr' | 'universal';
export type BundlerType = 'webpack' | 'rspack' | 'vite' | 'rollup' | 'rolldown' | 'parcel';
```

## Remote Resolution

### Description
Currently duplicated in remote resolution code and URL construction.

### Common Components to Abstract

```typescript
export class RemoteResolver {
  // Remote URL construction
  static constructRemoteUrl(base: string, remoteName: string, options?: RemoteUrlOptions): string;
  
  // Remote resolution
  static resolveRemote(remoteName: string, remoteUrl: string): Promise<any>;
  
  // Remote manifest handling
  static getRemoteManifestUrl(remoteUrl: string): string;
  static fetchRemoteManifest(remoteUrl: string): Promise<any>;
  
  // Compatibility validation
  static validateCompatibility(host: any, remote: any): CompatibilityResult;
}

export interface RemoteUrlOptions {
  protocol?: string;
  useSubdomain?: boolean;
  port?: number;
  basePath?: string;
}

export interface CompatibilityResult {
  compatible: boolean;
  issues: string[];
  warnings: string[];
}
```

## HTML Handling

### Description
Currently duplicated in BaseHrefIntegration, viteBaseHrefPlugin, and BaseHrefWebpackPlugin.

### Common Components to Abstract

```typescript
export class HtmlProcessor {
  // Base tag handling
  static addBaseTag(html: string, href: string, options?: Record<string, string>): string;
  static updateBaseTag(html: string, href: string): string;
  
  // Script injection
  static injectScript(html: string, scriptContent: string): string;
  
  // HTML parsing and manipulation
  static getHeadContent(html: string): string;
  static getBodyContent(html: string): string;
  static updateTagAttribute(html: string, tagName: string, attr: string, value: string): string;
}
```

## Error Handling

### Description
Currently duplicated across multiple implementations.

### Common Components to Abstract

```typescript
export class ErrorHandler {
  // Error creation
  static createError(message: string, code: string, details?: any): Error;
  
  // Error categorization
  static isFatalError(error: Error): boolean;
  static isRecoverableError(error: Error): boolean;
  
  // Error formatting
  static formatError(error: Error): string;
  static getErrorReport(error: Error): ErrorReport;
}

export interface ErrorReport {
  message: string;
  code: string;
  details?: any;
  stack?: string;
  recoverable: boolean;
}
```

## Caching

### Description
Currently duplicated in MetadataConsumer and other caching implementations.

### Common Components to Abstract

```typescript
export class CacheManager {
  // Cache operations
  static set<T>(key: string, value: T, options?: CacheOptions): void;
  static get<T>(key: string): T | undefined;
  static has(key: string): boolean;
  static delete(key: string): void;
  static clear(): void;
  
  // Cache helpers
  static getOrSet<T>(key: string, factory: () => T, options?: CacheOptions): T;
  static getOrSetAsync<T>(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T>;
}

export interface CacheOptions {
  ttl?: number;
  namespace?: string;
}
```

## Logging

### Description
Currently duplicated across multiple implementations.

### Common Components to Abstract

```typescript
export class Logger {
  // Log levels
  static debug(message: string, ...args: any[]): void;
  static info(message: string, ...args: any[]): void;
  static warn(message: string, ...args: any[]): void;
  static error(message: string, ...args: any[]): void;
  
  // Configuration
  static setLogLevel(level: LogLevel): void;
  static setPrefix(prefix: string): void;
  
  // Helpers
  static group(label: string, callback: () => void): void;
  static time(label: string, callback: () => void): void;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';
```

## Plugin Interface

### Description
Common plugin interface shared by all bundlers.

### Common Components to Abstract

```typescript
export interface BundlerPlugin<TOptions = any> {
  // Metadata
  name: string;
  version?: string;
  
  // Lifecycle methods
  setup(config: any, options: TOptions): any;
  beforeBuild?(context: BuildContext): void | Promise<void>;
  afterBuild?(context: BuildContext): void | Promise<void>;
  onError?(error: Error, context: BuildContext): void | Promise<void>;
  
  // Utility methods
  getManifest?(): any;
  resolveId?(id: string): string | null | Promise<string | null>;
  transform?(code: string, id: string): string | Promise<string>;
}

export interface BuildContext {
  config: any;
  bundlerType: BundlerType;
  outputPath: string;
  entrypoints: string[];
  assets: Asset[];
}

export interface Asset {
  name: string;
  source: string | Buffer;
  size: number;
  path?: string;
}
```

## Implementation Strategy

1. Define these abstractions in the zephyr-agent/zephyr-engine package
2. Start with the most widely used utilities (PathUtils, SchemaValidator)
3. Create comprehensive tests for each abstraction
4. Refactor existing implementations to use these abstractions
5. Ensure both xpack and rollx internal packages properly consume these abstractions
6. Implement bundler-specific adaptations in their respective packages
7. Document the abstraction layer with clear examples of usage

## Priority Order for Implementation

1. PathUtils
2. SchemaValidator
3. ConfigNormalizer
4. FeatureDetector
5. ManifestHandler
6. RemoteResolver
7. RuntimeDetector
8. HtmlProcessor
9. ErrorHandler
10. CacheManager
11. Logger
12. BundlerPlugin interface