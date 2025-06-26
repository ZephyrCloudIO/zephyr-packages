import { createSnapshotId, flatCreateSnapshotId } from '../create-snapshot-id';

describe('createSnapshotId', () => {
  test('should create a snapshot ID by combining build_id, platform target and application UID', () => {
    const options = {
      app: {
        org: 'My_Org!',
        project: 'My-Project#123',
        name: 'App Name@2024',
      },
      target: 'web',
      zeConfig: {
        user: 'test_user',
        buildId: 'build_123',
      },
    };
    const result = createSnapshotId(options);

    expect(result).toBe('test-web-build-123.app-name-2024.my-project-123.my-org-');
  });

  test('should handle empty strings correctly', () => {
    const options = {
      app: {
        org: '',
        project: '',
        name: '',
      },
      target: '',
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
      target: 'WEB',
      zeConfig: {
        user: 'USER',
        buildId: 'BUILDID',
      },
    };
    const result = createSnapshotId(options);

    expect(result).toBe('user-web-buildid.name.project.org');
  });
});

describe('flatCreateSnapshotId', () => {
  test('should create a snapshot ID by combining build_id, platform target and application UID', () => {
    const props = {
      org: 'My_Org!',
      project: 'My-Project#123',
      name: 'App Name@2024',
      username: 'test_user',
      buildId: '123',
      target: 'android',
    };
    const result = flatCreateSnapshotId(props);

    expect(result).toBe('test-android-123.app-name-2024.my-project-123.my-org-');
  });

  test('should handle empty strings correctly', () => {
    const props = {
      org: '',
      project: '',
      name: '',
      username: '',
      buildId: '',
      target: '',
    };
    const result = flatCreateSnapshotId(props);

    expect(result).toBe('-...');
  });

  test('should return a lowercased snapshot ID', () => {
    const props = {
      org: 'ORG',
      project: 'PROJECT',
      name: 'NAME',
      username: 'USER',
      buildId: 'BUILDID',
      target: 'PLATFORM',
    };
    const result = flatCreateSnapshotId(props);

    expect(result).toBe('user-platform-buildid.name.project.org');
  });
});
