import { describe, expect } from '@jest/globals';
import { isModuleFederationPlugin } from '../is-module-federation-plugin';
import { XPackConfiguration } from '../../xpack.types';

// Jest unit tests for isModuleFederationPlugin
type __webpack_plugin__ = NonNullable<XPackConfiguration<unknown>['plugins']>[number];

/** @private type Conversion for testing */
function __to_plugin__(plugin: unknown): __webpack_plugin__ {
  return plugin as unknown as __webpack_plugin__;
}

// Jest unit tests for isModuleFederationPlugin

describe('isModuleFederationPlugin', () => {
  it('should return false for undefined input', () => {
    expect(isModuleFederationPlugin(undefined)).toBe(false);
  });

  it('should return false for non-object input', () => {
    expect(isModuleFederationPlugin(__to_plugin__('string'))).toBe(false);
    expect(isModuleFederationPlugin(__to_plugin__(123))).toBe(false);
    expect(isModuleFederationPlugin(__to_plugin__(true))).toBe(false);
  });

  it('should return false for object with no constructor', () => {
    expect(isModuleFederationPlugin(__to_plugin__({}))).toBe(false);
  });

  it('should return true for object with constructor name containing "ModuleFederationPlugin"', () => {
    const plugin = __to_plugin__({ constructor: { name: 'ModuleFederationPlugin' } });
    expect(isModuleFederationPlugin(plugin)).toBe(true);
  });

  it('should return false for object with constructor name not containing "ModuleFederationPlugin"', () => {
    const plugin = __to_plugin__({ constructor: { name: 'SomeOtherPlugin' } });
    expect(isModuleFederationPlugin(plugin)).toBe(false);
  });

  it('should return true for object with name property containing "ModuleFederationPlugin"', () => {
    const plugin = __to_plugin__({ name: 'ModuleFederationPlugin' });
    expect(isModuleFederationPlugin(plugin)).toBe(true);
  });

  it('should return false for object with name property not containing "ModuleFederationPlugin"', () => {
    const plugin = __to_plugin__({ name: 'SomeOtherPlugin' });
    expect(isModuleFederationPlugin(plugin)).toBe(false);
  });

  it('should return true for object with both constructor and name containing "ModuleFederationPlugin"', () => {
    const plugin = __to_plugin__({
      constructor: { name: 'ModuleFederationPlugin' },
      name: 'ModuleFederationPlugin',
    });
    expect(isModuleFederationPlugin(plugin)).toBe(true);
  });

  it('should return false for object with constructor name partially matching "ModuleFederation"', () => {
    const plugin = __to_plugin__({ constructor: { name: 'ModuleFederation' } });
    expect(isModuleFederationPlugin(plugin)).toBe(false);
  });

  it('should return true for deeply nested object with constructor name "ModuleFederationPlugin"', () => {
    const plugin = __to_plugin__({
      constructor: { name: 'ModuleFederationPlugin' },
      nested: { otherProperty: 'value' },
    });
    expect(isModuleFederationPlugin(plugin)).toBe(true);
  });

  it('should return false for constructor property that is not an object', () => {
    const plugin = __to_plugin__({ constructor: 123 });
    expect(isModuleFederationPlugin(plugin)).toBe(false);
  });

  it('should return false for constructor with undefined name property', () => {
    const plugin = __to_plugin__({ constructor: { name: undefined } });
    expect(isModuleFederationPlugin(plugin)).toBe(false);
  });

  it('should return false for object with empty constructor name', () => {
    const plugin = __to_plugin__({ constructor: { name: '' } });
    expect(isModuleFederationPlugin(plugin)).toBe(false);
  });

  it('should return false for object with empty name property', () => {
    const plugin = __to_plugin__({ name: '' });
    expect(isModuleFederationPlugin(plugin)).toBe(false);
  });

  it('should return false for constructor name that is case insensitive', () => {
    const plugin = __to_plugin__({ constructor: { name: 'modulefederationplugin' } });
    expect(isModuleFederationPlugin(plugin)).toBe(false);
  });

  it('should return false for name property that is case insensitive', () => {
    const plugin = __to_plugin__({ name: 'moduleFederationPlugin' });
    expect(isModuleFederationPlugin(plugin)).toBe(false);
  });

  it('should return false for constructor name as a symbol', () => {
    const plugin = __to_plugin__({
      constructor: { name: Symbol('ModuleFederationPlugin') },
    });
    expect(isModuleFederationPlugin(plugin)).toBe(false);
  });

  it('should return false for name property as a function', () => {
    const plugin = __to_plugin__({ name: () => 'ModuleFederationPlugin' });
    expect(isModuleFederationPlugin(plugin)).toBe(false);
  });

  it('should return true for object inheriting with constructor name "ModuleFederationPlugin"', () => {
    class ModuleFederationPlugin {
      // constructor() {
      //   this.constructor.name = 'ModuleFederationPlugin';
      // }
    }

    const plugin = __to_plugin__(new ModuleFederationPlugin());
    expect(isModuleFederationPlugin(plugin)).toBe(true);
  });

  it('should return false for object inheriting with different constructor name', () => {
    class DifferentPlugin {
      // constructor() {
      //   this.constructor.name = 'DifferentPlugin';
      // }
    }

    const plugin = __to_plugin__(new DifferentPlugin());
    expect(isModuleFederationPlugin(plugin)).toBe(false);
  });

  it('should return false for object with non-standard name property type', () => {
    const plugin = __to_plugin__({ name: 123 });
    expect(isModuleFederationPlugin(plugin)).toBe(false);
  });
});
