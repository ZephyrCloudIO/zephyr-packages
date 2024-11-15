import { createApplicationUid } from '../create-application-uid';

describe('createApplicationUid', () => {
  test('should create a UID by replacing special characters with underscores', () => {
    const options = {
      org: 'My_Org!',
      project: 'My-Project#123',
      name: 'App Name@2024',
    };
    const result = createApplicationUid(options);

    expect(result).toBe('app-name-2024.my-project-123.my-org-');
  });

  test('should handle options without special characters correctly', () => {
    const options = {
      org: 'Org',
      project: 'Project',
      name: 'Name',
    };
    const result = createApplicationUid(options);

    expect(result).toBe('name.project.org');
  });

  test('should handle empty strings correctly', () => {
    const options = {
      org: '',
      project: '',
      name: '',
    };
    const result = createApplicationUid(options);

    expect(result).toBe('..');
  });

  test('should replace all non-alphanumeric characters with dash', () => {
    const options = {
      org: 'Org!@#',
      project: 'Project$%^',
      name: 'Name&*()',
    };
    const result = createApplicationUid(options);

    expect(result).toBe('name----.project---.org---');
  });

  test('should return a lowercased UID', () => {
    const options = {
      org: 'ORG',
      project: 'PROJECT',
      name: 'NAME',
    };
    const result = createApplicationUid(options);

    expect(result).toBe('name.project.org');
  });
});
