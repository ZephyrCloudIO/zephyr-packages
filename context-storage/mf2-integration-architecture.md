# Module Federation 2.0 Integration Architecture

This document outlines the architecture and approach for integrating Module Federation 2.0 support into the Zephyr packages, focusing on key components, data flow, and integration points.

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                         Zephyr Build Process                          │
├───────────┬───────────────────────────────────────┬───────────────────┤
│           │                                       │                   │
│  ┌────────▼──────────┐        ┌─────────────────┐ │ ┌───────────────┐ │
│  │   Plugin Detector │        │  Configuration  │ │ │ Asset Extractor│ │
│  │                   │◄──────►│    Extractor    │ │ │               │ │
│  │   MF 1.0 & 2.0    │        │  MF 1.0 & 2.0   │ │ │MF 1.0 & 2.0   │ │
│  └────────┬──────────┘        └────────┬────────┘ │ └───────┬───────┘ │
│           │                            │          │         │         │
├───────────┼────────────────────────────┼──────────┼─────────┼─────────┤
│           │                            │          │         │         │
│  ┌────────▼────────────────────────────▼──────────▼─────────▼───────┐ │
│  │                                                                   │ │
│  │                      Manifest Generator & Adapter                 │ │
│  │                                                                   │ │
│  │  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐ │ │
│  │  │   MF 1.0 Format │   │ Zephyr Format   │   │  MF 2.0 Format  │ │ │
│  │  └─────────────────┘   └─────────────────┘   └─────────────────┘ │ │
│  │                                                                   │ │
│  └───────────────────────────────┬───────────────────────────────────┘ │
│                                  │                                     │
├──────────────────────────────────┼─────────────────────────────────────┤
│                                  │                                     │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │                     Zephyr Runtime Generator                        ││
│  │                                                                     ││
│  │  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐   ││
│  │  │  MF 1.0 Runtime │   │Zephyr Base Code │   │ MF 2.0 Runtime  │   ││
│  │  │   Integration   │   │    Generation   │   │  Integration    │   ││
│  │  └─────────────────┘   └─────────────────┘   └─────────────────┘   ││
│  │                                                                     ││
│  └──────────────────────────────────┬──────────────────────────────────┘│
│                                     │                                   │
├─────────────────────────────────────┼───────────────────────────────────┤
│                                     │                                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      Zephyr Backend Integration                    │  │
│  │                                                                    │  │
│  │  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐  │  │
│  │  │  Asset Upload   │   │ Remote Resolution│   │ Version Control │  │  │
│  │  │    Service      │   │    Service      │   │    Service      │  │  │
│  │  └─────────────────┘   └─────────────────┘   └─────────────────┘  │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## Key Components and Responsibilities

### 1. Plugin Detector

**Purpose**: Identify and extract Module Federation plugins from build configuration

**Implementation Approach**:
- Enhance the `isModuleFederationPlugin` function to detect both MF 1.0 and 2.0 plugin types
- Add specific detection for @module-federation/enhanced plugins
- Implement version detection to determine which MF version is being used

### 2. Configuration Extractor

**Purpose**: Extract and normalize Module Federation configuration from detected plugins

**Implementation Approach**:
- Create an abstraction layer over MF 1.0 and 2.0 configurations
- Extract version-specific fields while maintaining a common interface
- Handle special cases for different plugin implementations (webpack, rspack, etc.)
- Implement support for runtime plugins configuration extraction

### 3. Asset Extractor

**Purpose**: Extract and classify assets from the build output

**Implementation Approach**:
- Enhance asset extraction to capture sync/async classification
- Support extraction of runtime plugin assets
- Implement more detailed asset metadata collection

### 4. Manifest Generator & Adapter

**Purpose**: Create and convert between different manifest formats

**Implementation Approach**:
- Implement bidirectional adapters between MF 2.0 manifest and Zephyr format
- Add version field to identify manifest format
- Create a normalized internal representation
- Implement validators for different manifest formats

### 5. Zephyr Runtime Generator

**Purpose**: Generate runtime code for resolving and loading remote modules

**Implementation Approach**:
- Create version-specific runtime code templates
- Enhance delegate module template for MF 2.0 container protocol
- Implement runtime plugin support
- Extend error handling with retry and fallback capabilities

### 6. Zephyr Backend Integration

**Purpose**: Integrate with Zephyr backend services for remote resolution, asset management, etc.

**Implementation Approach**:
- Extend asset upload to support MF 2.0 manifest format
- Enhance remote resolution to support both MF versions
- Implement versioning for backward compatibility

## Data Flow

1. **Build Phase**:
   - Plugin detection identifies MF plugin and version
   - Configuration extraction normalizes configuration
   - Asset extractor captures assets and metadata
   - Manifest generator creates appropriate manifest format

2. **Runtime Phase**:
   - Generated runtime code integrates with MF container protocol
   - Remote resolution uses Zephyr backend to fetch remote URLs
   - Runtime plugins extend functionality as needed

3. **Resolution Phase**:
   - Remote dependencies are resolved through Zephyr
   - Version conflicts are managed according to configuration
   - Fallback strategies are applied when resolution fails

## Integration Strategy

### Version Detection and Handling

```typescript
function detectMFVersion(plugin: any): 'MF1' | 'MF2' | 'unknown' {
  if (plugin?.constructor?.name?.includes('@module-federation/enhanced')) {
    return 'MF2';
  } else if (plugin?.constructor?.name?.includes('ModuleFederationPlugin')) {
    return 'MF1';
  } else if (plugin?.name?.includes('@module-federation/enhanced')) {
    return 'MF2';
  } else if (plugin?.name?.includes('ModuleFederationPlugin')) {
    return 'MF1';
  }
  return 'unknown';
}
```

### Manifest Adaptation

```typescript
interface ManifestAdapter {
  toZephyr(manifest: MF2Manifest): ZephyrManifest;
  fromZephyr(manifest: ZephyrManifest): MF2Manifest;
  isCompatible(manifest: unknown): boolean;
}
```

### Runtime Code Generation

The runtime code generation will be version-specific but follow a common pattern:

1. Detect MF version and appropriate container protocol
2. Generate version-specific remote resolution code
3. Inject runtime plugins if applicable
4. Implement appropriate error handling and fallback strategies

## Backward Compatibility

To ensure backward compatibility:

1. **Versioned Storage**:
   - Add version field to ~/.zephyr storage files
   - Implement migration utilities for existing data

2. **Dual Format Support**:
   - Support both MF 1.0 and 2.0 formats simultaneously
   - Fall back to MF 1.0 handling when 2.0 features are not detected

3. **Gradual Feature Adoption**:
   - Allow incremental adoption of MF 2.0 features
   - Make runtime plugins optional

## Implementation Phasing

The implementation should follow this sequence:

1. **Core Detection & Extraction**: Enhance detection and configuration extraction
2. **Manifest Adaptation**: Implement manifest format conversion
3. **Runtime Generation**: Update runtime code generation
4. **Plugin Support**: Add runtime plugin support
5. **Asset Enhancement**: Improve asset handling
6. **Advanced Features**: Implement version control and fallback strategies