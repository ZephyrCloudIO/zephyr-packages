/* eslint-disable @typescript-eslint/no-explicit-any */
import { validateParams } from './validate-params';

describe('validateParams', () => {
  // Positive tests
  it('should pass with valid parameters', () => {
    const params = {
      federationRemoteEntry: {
        origins: [{ loc: 'example.com' }],
      },
      topLevelPackage: {
        dependencies: {},
        devDependencies: {},
        optionalDependencies: {},
      },
      metadata: {},
      modules: [
        {
          identifier: 'module1',
          reasons: [],
          moduleType: 'consume-shared-module',
          name: 'container entry',
          issuerName: 'issuer1',
        },
      ],
    };
    expect(() => validateParams(params as any, false)).not.toThrow();
  });

  // Negative tests
  it('should throw an error if federationRemoteEntry.origins[0].loc is not defined', () => {
    const params = {
      federationRemoteEntry: {
        origins: [{}] as { loc: string }[],
      },
      topLevelPackage: {
        dependencies: {},
        devDependencies: {},
        optionalDependencies: {},
      },
      metadata: {},
      modules: [],
    };
    expect(() => validateParams(params as any, false)).toThrow(
      'Modules must be defined and have length'
    );
  });

  it('should throw an error if modules are not defined and standalone is false', () => {
    const params = {
      federationRemoteEntry: {
        origins: [{ loc: 'example.com' }],
      },
      topLevelPackage: {
        dependencies: {},
        devDependencies: {},
        optionalDependencies: {},
      },
      metadata: {},
      modules: undefined as any,
    };
    expect(() => validateParams(params as any, false)).toThrow(
      'Modules must be defined and have length'
    );
  });

  it('should throw an error if topLevelPackage.dependencies is not defined', () => {
    const params = {
      federationRemoteEntry: {
        origins: [{ loc: 'example.com' }],
      },
      topLevelPackage: {} as any,
      metadata: {},
      modules: [],
    };
    expect(() => validateParams(params as any, false)).toThrow(
      'Modules must be defined and have length'
    );
  });

  it('should throw an error if topLevelPackage.devDependencies is not defined', () => {
    const params = {
      federationRemoteEntry: {
        origins: [{ loc: 'example.com' }],
      },
      topLevelPackage: {
        dependencies: {},
      } as any,
      metadata: {},
      modules: [],
    };
    expect(() => validateParams(params as any, false)).toThrow(
      'Modules must be defined and have length'
    );
  });

  it('should throw an error if topLevelPackage.optionalDependencies is not defined', () => {
    const params = {
      federationRemoteEntry: {
        origins: [{ loc: 'example.com' }],
      },
      topLevelPackage: {
        dependencies: {},
        devDependencies: {},
      } as any,
      metadata: {},
      modules: [],
    };
    expect(() => validateParams(params as any, false)).toThrow(
      'Modules must be defined and have length'
    );
  });

  it('should throw an error if module.identifier is not defined', () => {
    const params = {
      federationRemoteEntry: {
        origins: [{ loc: 'example.com' }],
      },
      topLevelPackage: {
        dependencies: {},
        devDependencies: {},
        optionalDependencies: {},
      },
      metadata: {},
      modules: [
        {
          reasons: [],
          moduleType: 'consume-shared-module',
          name: 'container entry',
          issuerName: 'issuer1',
        },
      ] as any,
    };
    expect(() => validateParams(params as any, false)).toThrow(
      'module.identifier must be defined'
    );
  });

  it('should throw an error if module.reasons is not defined', () => {
    const params = {
      federationRemoteEntry: {
        origins: [{ loc: 'example.com' }],
      },
      topLevelPackage: {
        dependencies: {},
        devDependencies: {},
        optionalDependencies: {},
      },
      metadata: {},
      modules: [
        {
          identifier: 'module1',
          moduleType: 'consume-shared-module',
          name: 'container entry',
          issuerName: 'issuer1',
        },
      ] as any,
    };
    expect(() => validateParams(params as any, false)).toThrow(
      'module.reasons must be defined'
    );
  });

  it('should throw an error if module.issuerName is not defined for certain module types', () => {
    const params = {
      federationRemoteEntry: {
        origins: [{ loc: 'example.com' }],
      },
      topLevelPackage: {
        dependencies: {},
        devDependencies: {},
        optionalDependencies: {},
      },
      metadata: {},
      modules: [
        {
          identifier: 'module1',
          reasons: [],
          moduleType: 'consume-shared-module',
          name: 'container entry',
        },
      ],
    };
    expect(() => validateParams(params as any, false)).toThrow(
      'module.issuerName must be defined'
    );
  });

  // Exception tests
  it('should throw an error if standalone is false and modules are undefined', () => {
    const params = {
      federationRemoteEntry: {
        origins: [{ loc: 'example.com' }],
      },
      topLevelPackage: {
        dependencies: {},
        devDependencies: {},
        optionalDependencies: {},
      },
      metadata: {},
    } as any;
    expect(() => validateParams(params, false)).toThrow(
      'Modules must be defined and have length'
    );
  });
});
