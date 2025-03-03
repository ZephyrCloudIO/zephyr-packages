/**
 * SchemaValidator - Core utility for schema validation
 * 
 * This abstraction centralizes all schema validation functionality to eliminate 
 * duplication between different implementations.
 */

/**
 * Supported schema property types
 */
export type SchemaPropertyType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'any';

/**
 * Schema property definition
 */
export interface SchemaProperty {
  type: SchemaPropertyType | SchemaPropertyType[];
  enum?: any[];
  pattern?: RegExp | string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  format?: string;
  properties?: SchemaProperties;
  items?: SchemaProperty | SchemaProperty[];
  required?: string[];
  additionalProperties?: boolean | SchemaProperty;
}

/**
 * Schema properties object
 */
export interface SchemaProperties {
  [key: string]: SchemaProperty;
}

/**
 * Schema definition
 */
export interface Schema {
  type?: SchemaPropertyType | SchemaPropertyType[];
  properties?: SchemaProperties;
  required?: string[];
  additionalProperties?: boolean | SchemaProperty;
}

/**
 * Version validation options
 */
export interface VersionValidationOptions {
  /**
   * Allow semver ranges (^, ~, >, <, etc.)
   */
  allowRange?: boolean;
  
  /**
   * Allow pre-release versions (alpha, beta, etc.)
   */
  allowPrerelease?: boolean;
  
  /**
   * Allow build metadata
   */
  allowBuildMetadata?: boolean;
}

/**
 * Validation error details
 */
export interface ValidationError {
  /**
   * Path to the property with the error
   */
  path: string;
  
  /**
   * Error message
   */
  message: string;
  
  /**
   * Expected schema
   */
  expected?: any;
  
  /**
   * Actual value
   */
  actual?: any;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /**
   * Whether validation passed
   */
  valid: boolean;
  
  /**
   * Validation errors if any
   */
  errors: ValidationError[];
}

/**
 * SchemaValidator - Main class for schema validation
 */
export class SchemaValidator {
  /**
   * Simple semver regex
   * @private
   */
  private static readonly SEMVER_REGEX = /^\d+\.\d+\.\d+(-[0-9A-Za-z-.]+)?(\+[0-9A-Za-z-.]+)?$/;
  
  /**
   * Semver range regex
   * @private
   */
  private static readonly SEMVER_RANGE_REGEX = /^(\^|~|>=|<=|>|<|=)?\d+\.\d+\.\d+(-[0-9A-Za-z-.]+)?(\+[0-9A-Za-z-.]+)?$/;

  /**
   * Validates data against a schema
   * 
   * @param data Data to validate
   * @param schema Schema to validate against
   * @returns Validation result with errors if any
   */
  static validate(data: any, schema: Schema): ValidationResult {
    const errors: ValidationError[] = [];
    this.validateValue(data, schema, '', errors);
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Type guard that validates data against a schema
   * 
   * @param data Data to validate
   * @param schema Schema to validate against
   * @returns Whether the data conforms to the schema
   */
  static isValid<T>(data: any, schema: Schema): data is T {
    const result = this.validate(data, schema);
    return result.valid;
  }

  /**
   * Validates a value against a schema property
   * @private
   */
  private static validateValue(value: any, schema: Schema | SchemaProperty, path: string, errors: ValidationError[]): void {
    // Check type
    if (schema.type) {
      this.validateType(value, schema.type, path, errors);
    }
    
    // Check required properties
    if (schema.properties && schema.required && typeof value === 'object' && value !== null) {
      this.validateRequired(value, schema.required, path, errors);
    }
    
    // Validate properties
    if (schema.properties && typeof value === 'object' && value !== null) {
      this.validateProperties(value, schema.properties, path, errors);
    }
    
    // Validate additional properties
    if (schema.additionalProperties !== undefined && typeof value === 'object' && value !== null) {
      this.validateAdditionalProperties(value, schema, path, errors);
    }
    
    // Validate array items
    if (schema.items && Array.isArray(value)) {
      this.validateItems(value, schema.items, path, errors);
    }
    
    // Validate enum
    if (schema.enum && schema.enum.length > 0) {
      this.validateEnum(value, schema.enum, path, errors);
    }
    
    // Validate string-specific constraints
    if (typeof value === 'string') {
      this.validateStringConstraints(value, schema as SchemaProperty, path, errors);
    }
    
    // Validate number-specific constraints
    if (typeof value === 'number') {
      this.validateNumberConstraints(value, schema as SchemaProperty, path, errors);
    }
  }

  /**
   * Validates the type of a value
   * @private
   */
  private static validateType(value: any, type: SchemaPropertyType | SchemaPropertyType[], path: string, errors: ValidationError[]): void {
    const types = Array.isArray(type) ? type : [type];
    
    if (types.includes('any')) {
      return;
    }
    
    const valueType = this.getType(value);
    
    if (!types.includes(valueType)) {
      errors.push({
        path,
        message: `Expected type ${types.join(' | ')}, got ${valueType}`,
        expected: types,
        actual: valueType
      });
    }
  }

  /**
   * Gets the type of a value
   * @private
   */
  private static getType(value: any): SchemaPropertyType {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value as SchemaPropertyType;
  }

  /**
   * Validates required properties
   * @private
   */
  private static validateRequired(value: any, required: string[], path: string, errors: ValidationError[]): void {
    for (const prop of required) {
      if (value[prop] === undefined) {
        errors.push({
          path: path ? `${path}.${prop}` : prop,
          message: `Missing required property: ${prop}`
        });
      }
    }
  }

  /**
   * Validates properties of an object
   * @private
   */
  private static validateProperties(value: any, properties: SchemaProperties, path: string, errors: ValidationError[]): void {
    for (const [propName, propSchema] of Object.entries(properties)) {
      if (value[propName] !== undefined) {
        this.validateValue(
          value[propName],
          propSchema,
          path ? `${path}.${propName}` : propName,
          errors
        );
      }
    }
  }

  /**
   * Validates additional properties
   * @private
   */
  private static validateAdditionalProperties(value: any, schema: Schema, path: string, errors: ValidationError[]): void {
    const propertyNames = Object.keys(value);
    const schemaPropertyNames = schema.properties ? Object.keys(schema.properties) : [];
    
    for (const propName of propertyNames) {
      if (!schemaPropertyNames.includes(propName)) {
        if (schema.additionalProperties === false) {
          errors.push({
            path: path ? `${path}.${propName}` : propName,
            message: `Additional property not allowed: ${propName}`
          });
        } else if (typeof schema.additionalProperties === 'object') {
          this.validateValue(
            value[propName],
            schema.additionalProperties as SchemaProperty,
            path ? `${path}.${propName}` : propName,
            errors
          );
        }
      }
    }
  }

  /**
   * Validates items in an array
   * @private
   */
  private static validateItems(value: any[], items: SchemaProperty | SchemaProperty[], path: string, errors: ValidationError[]): void {
    if (Array.isArray(items)) {
      // Tuple validation
      for (let i = 0; i < Math.min(value.length, items.length); i++) {
        this.validateValue(
          value[i],
          items[i],
          path ? `${path}[${i}]` : `[${i}]`,
          errors
        );
      }
    } else {
      // Array validation (all items against the same schema)
      for (let i = 0; i < value.length; i++) {
        this.validateValue(
          value[i],
          items,
          path ? `${path}[${i}]` : `[${i}]`,
          errors
        );
      }
    }
  }

  /**
   * Validates enum values
   * @private
   */
  private static validateEnum(value: any, enumValues: any[], path: string, errors: ValidationError[]): void {
    if (!enumValues.includes(value)) {
      errors.push({
        path,
        message: `Value must be one of: ${enumValues.join(', ')}`,
        expected: enumValues,
        actual: value
      });
    }
  }

  /**
   * Validates string-specific constraints
   * @private
   */
  private static validateStringConstraints(value: string, schema: SchemaProperty, path: string, errors: ValidationError[]): void {
    // Validate minLength
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        path,
        message: `String length must be at least ${schema.minLength}`,
        expected: `length >= ${schema.minLength}`,
        actual: `length = ${value.length}`
      });
    }
    
    // Validate maxLength
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        path,
        message: `String length must be at most ${schema.maxLength}`,
        expected: `length <= ${schema.maxLength}`,
        actual: `length = ${value.length}`
      });
    }
    
    // Validate pattern
    if (schema.pattern) {
      const pattern = typeof schema.pattern === 'string' 
        ? new RegExp(schema.pattern) 
        : schema.pattern;
      
      if (!pattern.test(value)) {
        errors.push({
          path,
          message: `String must match pattern: ${pattern}`,
          expected: pattern.toString(),
          actual: value
        });
      }
    }
    
    // Validate format
    if (schema.format) {
      if (schema.format === 'email' && !this.isValidEmail(value)) {
        errors.push({
          path,
          message: 'Invalid email format',
          expected: 'email format',
          actual: value
        });
      } else if (schema.format === 'uri' && !this.isValidUri(value)) {
        errors.push({
          path,
          message: 'Invalid URI format',
          expected: 'URI format',
          actual: value
        });
      } else if (schema.format === 'semver' && !this.isValidVersion(value)) {
        errors.push({
          path,
          message: 'Invalid semantic version format',
          expected: 'semver format',
          actual: value
        });
      }
    }
  }

  /**
   * Validates number-specific constraints
   * @private
   */
  private static validateNumberConstraints(value: number, schema: SchemaProperty, path: string, errors: ValidationError[]): void {
    // Validate minimum
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        path,
        message: `Value must be at least ${schema.minimum}`,
        expected: `>= ${schema.minimum}`,
        actual: value
      });
    }
    
    // Validate maximum
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        path,
        message: `Value must be at most ${schema.maximum}`,
        expected: `<= ${schema.maximum}`,
        actual: value
      });
    }
  }

  /**
   * Checks if a string is a valid email
   * @private
   */
  private static isValidEmail(value: string): boolean {
    // Basic email validation
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  /**
   * Checks if a string is a valid URI
   * @private
   */
  private static isValidUri(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if a string is a valid version
   * @private
   */
  private static isValidVersion(value: string, options?: VersionValidationOptions): boolean {
    if (!options?.allowRange) {
      return this.SEMVER_REGEX.test(value);
    } else {
      return this.SEMVER_RANGE_REGEX.test(value);
    }
  }

  /**
   * Validates a version string
   * 
   * @param version Version string to validate
   * @param options Validation options
   * @returns Whether the version string is valid
   */
  static isValidVersionFormat(version: string, options: VersionValidationOptions = {}): boolean {
    const { allowRange = false, allowPrerelease = true, allowBuildMetadata = true } = options;
    
    // Basic version format without prerelease or build metadata
    const basePattern = '\\d+\\.\\d+\\.\\d+';
    
    // Prerelease pattern
    const prereleasePattern = allowPrerelease ? '(-[0-9A-Za-z-.]+)?' : '';
    
    // Build metadata pattern
    const buildMetadataPattern = allowBuildMetadata ? '(\\+[0-9A-Za-z-.]+)?' : '';
    
    // Range prefix pattern
    const rangePrefixPattern = allowRange ? '(\\^|~|>=|<=|>|<|=)?' : '';
    
    // Complete pattern
    const pattern = `^${rangePrefixPattern}${basePattern}${prereleasePattern}${buildMetadataPattern}$`;
    const regex = new RegExp(pattern);
    
    return regex.test(version);
  }

  /**
   * Creates a schema for a metadata object
   * 
   * @returns Schema for validating metadata
   */
  static createMetadataSchema(): Schema {
    return {
      type: 'object',
      properties: {
        schemaVersion: {
          type: 'string',
          format: 'semver'
        },
        moduleFederationVersion: {
          type: 'string',
          format: 'semver'
        },
        renderType: {
          type: 'string',
          enum: ['csr', 'ssr', 'universal']
        },
        framework: {
          type: 'string'
        },
        frameworkVersion: {
          type: 'string',
          format: 'semver'
        },
        dependencies: {
          type: 'object',
          additionalProperties: {
            type: 'string'
          }
        },
        exports: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              import: {
                type: 'string'
              },
              types: {
                type: 'string'
              }
            },
            required: ['import']
          }
        }
      },
      required: ['schemaVersion', 'moduleFederationVersion', 'renderType', 'framework']
    };
  }

  /**
   * Validates a metadata object
   * 
   * @param metadata Metadata object to validate
   * @returns Validation result
   */
  static validateMetadata(metadata: any): ValidationResult {
    const schema = this.createMetadataSchema();
    return this.validate(metadata, schema);
  }

  /**
   * Creates a schema for plugin options
   * 
   * @param optionsProperties Schema properties for specific options
   * @param requiredOptions List of required options
   * @returns Schema for validating plugin options
   */
  static createPluginOptionsSchema(
    optionsProperties: SchemaProperties, 
    requiredOptions: string[] = []
  ): Schema {
    return {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean'
        },
        ...optionsProperties
      },
      required: requiredOptions
    };
  }
}