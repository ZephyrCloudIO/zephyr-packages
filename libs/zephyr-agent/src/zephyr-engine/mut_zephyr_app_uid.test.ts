import { mut_zephyr_app_uid } from './mut_zephyr_app_uid';

// Mock the createApplicationUid function
jest.mock('zephyr-edge-contract', () => ({
  createApplicationUid: jest.fn((props) => `${props.org}.${props.project}.${props.name}`),
}));

describe('mut_zephyr_app_uid', () => {
  const mockZeData = {
    npmProperties: {
      name: 'my-app',
      version: '1.0.0',
    },
    gitProperties: {
      app: {
        org: 'my-org',
        project: 'my-project',
      },
    },
  };

  it('should create application properties from npm and git properties', () => {
    const result = mut_zephyr_app_uid(mockZeData);

    expect(result.applicationProperties).toEqual({
      org: 'my-org',
      project: 'my-project',
      name: 'my-app',
      version: '1.0.0',
    });
  });

  it('should create application_uid using createApplicationUid', () => {
    const result = mut_zephyr_app_uid(mockZeData);

    expect(result.application_uid).toBe('my-org.my-project.my-app');
  });

  it('should handle different org and project names', () => {
    const customData = {
      npmProperties: {
        name: 'different-app',
        version: '2.0.0',
      },
      gitProperties: {
        app: {
          org: 'different-org',
          project: 'different-project',
        },
      },
    };

    const result = mut_zephyr_app_uid(customData);

    expect(result.applicationProperties).toEqual({
      org: 'different-org',
      project: 'different-project',
      name: 'different-app',
      version: '2.0.0',
    });
    expect(result.application_uid).toBe('different-org.different-project.different-app');
  });
});
