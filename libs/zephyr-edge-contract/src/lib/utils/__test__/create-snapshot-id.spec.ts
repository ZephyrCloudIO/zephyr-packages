import { createSnapshotId, flatCreateSnapshotId } from '../create-snapshot-id';

describe('createSnapshotId', () => {
  test('should create a snapshot ID by combining build_id and application UID', () => {
    const options = {
      app: {
        org: 'My_Org!',
        project: 'My-Project#123',
        name: 'App Name@2024',
      },
      zeConfig: {
        user: 'test_user',
        buildId: 'build_123',
      },
    };
    const result = createSnapshotId(options);

    expect(result).toBe('test-user-build-123.app-name-2024.my-project-123.my-org-');
  });

  test('should handle empty strings correctly', () => {
    const options = {
      app: {
        org: '',
        project: '',
        name: '',
      },
      zeConfig: {
        user: '',
        buildId: '',
      },
    };
    const result = createSnapshotId(options);

    expect(result).toBe('-...');
  });

  test('should return a lowercased snapshot ID', () => {
    const options = {
      app: {
        org: 'ORG',
        project: 'PROJECT',
        name: 'NAME',
      },
      zeConfig: {
        user: 'USER',
        buildId: 'BUILDID',
      },
    };
    const result = createSnapshotId(options);

    expect(result).toBe('USER-BUILDID.name.project.org');
  });
});

describe('flatCreateSnapshotId', () => {
  test('should create a snapshot ID by combining build_id and application UID', () => {
    const props = {
      org: 'My_Org!',
      project: 'My-Project#123',
      name: 'App Name@2024',
      username: 'test_user',
      buildId: 'build_123',
    };
    const result = flatCreateSnapshotId(props);

    expect(result).toBe('test_user_build_123.app-name-2024.my-project-123.my-org-');
  });

  test('should handle empty strings correctly', () => {
    const props = {
      org: '',
      project: '',
      name: '',
      username: '',
      buildId: '',
    };
    const result = flatCreateSnapshotId(props);

    expect(result).toBe('_...');
  });

  test('should return a lowercased snapshot ID', () => {
    const props = {
      org: 'ORG',
      project: 'PROJECT',
      name: 'NAME',
      username: 'USER',
      buildId: 'BUILDID',
    };
    const result = flatCreateSnapshotId(props);

    expect(result).toBe('USER_BUILDID.name.project.org');
  });
});
