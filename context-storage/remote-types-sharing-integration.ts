/**
 * Remote Types Sharing Integration
 * 
 * This file integrates the Remote Types Detection functionality with the Remote Entry Structure Sharing feature,
 * enabling enhanced metadata sharing between federated modules.
 */

import { RemoteMetadata } from './remote-entry-structure-sharing-skeleton';
import { 
  RemoteTypeIntegration, 
  FrameworkDetector, 
  RenderType, 
  FrameworkType 
} from './remote-types-detection-skeleton';

/**
 * Enhances Remote Entry metadata with remote types information
 */
export class RemoteTypesEnhancer {
  /**
   * Enhances Remote Entry metadata with render type and framework information
   * 
   * @param metadata Existing Remote Entry metadata
   * @param packageJson Package.json contents
   * @param bundlerConfig Bundler configuration (optional)
   * @returns Enhanced metadata with remote types information
   */
  static enhanceMetadata(
    metadata: RemoteMetadata, 
    packageJson: any, 
    bundlerConfig?: any
  ): RemoteMetadata {
    // Create a working copy to avoid modifying the original
    const enhancedMetadata = { ...metadata };
    
    // Detect framework
    const detectedFramework = FrameworkDetector.detectFramework(packageJson?.dependencies || {});
    
    // Determine render type
    const renderTypeIntegration = RemoteTypeIntegration.determineRemoteType(
      packageJson, 
      metadata,  // Allow existing metadata to influence detection
      bundlerConfig
    );
    
    // Only set these fields if they're not already present
    if (!enhancedMetadata.renderType) {
      enhancedMetadata.renderType = renderTypeIntegration;
    }
    
    if (!enhancedMetadata.framework) {
      enhancedMetadata.framework = detectedFramework;
    }
    
    // Add framework version if available and not already present
    if (!enhancedMetadata.frameworkVersion && detectedFramework !== 'unknown' && packageJson?.dependencies) {
      const frameworkDep = FrameworkDetector.FRAMEWORK_MATCHERS[detectedFramework][0];
      if (frameworkDep && packageJson.dependencies[frameworkDep]) {
        enhancedMetadata.frameworkVersion = packageJson.dependencies[frameworkDep];
      }
    }
    
    return enhancedMetadata;
  }
  
  /**
   * Checks compatibility between host and remote metadata based on render types
   * 
   * @param hostMetadata Host metadata
   * @param remoteMetadata Remote metadata
   * @returns Compatibility result with issues and warnings
   */
  static checkRenderTypeCompatibility(
    hostMetadata: RemoteMetadata, 
    remoteMetadata: RemoteMetadata
  ): { compatible: boolean; issues: string[]; warnings: string[] } {
    const result = {
      compatible: true,
      issues: [] as string[],
      warnings: [] as string[]
    };
    
    const hostRenderType = hostMetadata.renderType || 'csr';
    const remoteRenderType = remoteMetadata.renderType || 'csr';
    
    // Check renderType compatibility
    if (hostRenderType !== remoteRenderType) {
      // CSR host can't use SSR remotes
      if (hostRenderType === 'csr' && remoteRenderType === 'ssr') {
        result.compatible = false;
        result.issues.push(`Render type mismatch: host is ${hostRenderType}, remote is ${remoteRenderType}. CSR hosts cannot consume SSR remotes.`);
      } 
      // SSR host with CSR remote is fine but warn
      else if (hostRenderType === 'ssr' && remoteRenderType === 'csr') {
        result.warnings.push(`Render type mismatch: host is ${hostRenderType}, remote is ${remoteRenderType}. SSR hosts can consume CSR remotes, but may show hydration warnings.`);
      }
      // Universal is compatible with anything
      else if (hostRenderType !== 'universal' && remoteRenderType !== 'universal') {
        result.warnings.push(`Render type mismatch: host is ${hostRenderType}, remote is ${remoteRenderType}.`);
      }
    }
    
    // Check framework compatibility
    const hostFramework = hostMetadata.framework || 'unknown';
    const remoteFramework = remoteMetadata.framework || 'unknown';
    
    if (hostFramework !== remoteFramework && 
        hostFramework !== 'unknown' && 
        remoteFramework !== 'unknown') {
      result.warnings.push(`Framework mismatch: host is ${hostFramework}, remote is ${remoteFramework}. This may cause runtime issues.`);
    }
    
    return result;
  }
}

/**
 * Integration factory for adding Remote Types to Remote Entry Structure Sharing
 */
export class RemoteTypesIntegrationFactory {
  /**
   * Creates a metadata enhancer plugin for Remote Entry Structure Sharing
   * 
   * @returns A plugin for enhancing remote entry metadata
   */
  static createMetadataEnhancerPlugin() {
    return {
      name: 'remote-types-enhancer',
      enhanceMetadata: RemoteTypesEnhancer.enhanceMetadata
    };
  }
  
  /**
   * Creates a compatibility checker plugin for Remote Entry Structure Sharing
   * 
   * @returns A plugin for checking compatibility between host and remote
   */
  static createCompatibilityCheckerPlugin() {
    return {
      name: 'remote-types-compatibility-checker',
      checkCompatibility: RemoteTypesEnhancer.checkRenderTypeCompatibility
    };
  }
}