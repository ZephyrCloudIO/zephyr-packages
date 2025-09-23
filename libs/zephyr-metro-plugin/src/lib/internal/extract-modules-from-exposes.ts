import type { ModuleFederationPlugin, XFederatedSharedConfig } from './types';

/**
 * Extracts exposed modules from Module Federation configuration Creates formatted module
 * entries for the build stats
 */
export function extractModulesFromExposes(
  mfConfig: ModuleFederationPlugin['config'] | undefined,
  applicationID: string
): Array<{
  id: string;
  name: string;
  applicationID: string;
  requires: string[];
  file: string;
}> {
  if (!mfConfig?.exposes) {
    return [];
  }

  // Extract exposed modules from the Module Federation config
  return Object.entries(mfConfig.exposes).map(([exposedPath, filePath]) => {
    // Handle different formats of exposes configuration
    // In Module Federation, exposes can be an object where key is the exposed path and value is the file path
    // Example: { './Button': './src/Button' }

    // Normalize the file path (it might be an object in some federation implementations)
    const normalizedFilePath =
      typeof filePath === 'string'
        ? filePath
        : typeof filePath === 'object' && filePath !== null && 'import' in filePath
          ? String((filePath as { import: string }).import)
          : String(filePath);

    // Extract just the module name from the exposed path (removing './')
    const name = exposedPath.startsWith('./') ? exposedPath.substring(2) : exposedPath;

    // Create a unique ID for this module in the format used by Module Federation Dashboard
    const id = `${name}:${name}`;

    // Extract any potential requirements from shared dependencies
    // In a more complete implementation, this would analyze the actual file to find imports
    const requires: string[] = [];

    // If we have shared dependencies and they're an object with keys, use them as requirements
    if (mfConfig.shared) {
      if (Array.isArray(mfConfig.shared)) {
        // Handle array format: ['react', 'react-dom']
        requires.push(
          ...mfConfig.shared
            .map((item: string | XFederatedSharedConfig) => {
              return typeof item === 'string'
                ? item
                : typeof item === 'object' && item !== null && 'libraryName' in item
                  ? String(item.libraryName)
                  : '';
            })
            .filter(Boolean)
        );
      } else if (typeof mfConfig.shared === 'object' && mfConfig.shared !== null) {
        // Handle object format: { react: {...}, 'react-dom': {...} }
        requires.push(...Object.keys(mfConfig.shared));
      }
    }

    // Handle additionalShared format from Nx webpack module federation
    if (mfConfig.additionalShared && Array.isArray(mfConfig.additionalShared)) {
      requires.push(
        ...mfConfig.additionalShared
          .map((item: string | XFederatedSharedConfig) =>
            typeof item === 'object' && item !== null && 'libraryName' in item
              ? String(item.libraryName)
              : ''
          )
          .filter(Boolean)
      );
    }

    return {
      id,
      name,
      applicationID,
      requires,
      file: normalizedFilePath,
    };
  });
}
