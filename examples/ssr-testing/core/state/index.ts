/**
 * State Comparer
 * 
 * A utility for comparing server and client state to ensure consistency.
 * Validates that state is properly transferred and hydrated.
 */

export interface StateComparisonOptions {
  /**
   * Whether to ignore specific state fields
   */
  ignoreFields?: string[];
  
  /**
   * Whether to allow subset matching (client state can be a subset of server state)
   */
  allowSubset?: boolean;
  
  /**
   * Custom comparator functions for specific fields
   */
  customComparators?: Record<string, (a: any, b: any) => boolean>;
  
  /**
   * Whether to use deep comparison for objects
   */
  deepCompare?: boolean;
}

export interface ComparisonResult {
  /**
   * Whether the states match according to the comparison options
   */
  match: boolean;
  
  /**
   * Fields that didn't match between server and client state
   */
  differences: Array<{
    path: string;
    serverValue: any;
    clientValue: any;
  }>;
  
  /**
   * Whether a full or partial match was performed
   */
  matchType: 'full' | 'subset' | 'custom';
}

/**
 * Compares server and client state for consistency
 */
export function compareState(
  serverState: Record<string, any>,
  clientState: Record<string, any>,
  options: StateComparisonOptions = {}
): ComparisonResult {
  const {
    ignoreFields = [],
    allowSubset = false,
    customComparators = {},
    deepCompare = true,
  } = options;
  
  const differences: Array<{
    path: string;
    serverValue: any;
    clientValue: any;
  }> = [];
  
  // Determine match type
  let matchType: 'full' | 'subset' | 'custom' = 'full';
  if (Object.keys(customComparators).length > 0) {
    matchType = 'custom';
  } else if (allowSubset) {
    matchType = 'subset';
  }
  
  // Compare states
  if (deepCompare) {
    compareDeep(serverState, clientState, '', ignoreFields, allowSubset, customComparators, differences);
  } else {
    compareShallow(serverState, clientState, ignoreFields, allowSubset, customComparators, differences);
  }
  
  return {
    match: differences.length === 0,
    differences,
    matchType,
  };
}

/**
 * Deep comparison of nested objects
 */
function compareDeep(
  serverState: Record<string, any>,
  clientState: Record<string, any>,
  path: string,
  ignoreFields: string[],
  allowSubset: boolean,
  customComparators: Record<string, (a: any, b: any) => boolean>,
  differences: Array<{ path: string; serverValue: any; clientValue: any }>
): void {
  // Check all keys in server state
  for (const key in serverState) {
    const currentPath = path ? `${path}.${key}` : key;
    
    // Skip ignored fields
    if (ignoreFields.includes(key) || ignoreFields.includes(currentPath)) {
      continue;
    }
    
    // Check if key exists in client state
    if (!(key in clientState)) {
      if (!allowSubset) {
        differences.push({
          path: currentPath,
          serverValue: serverState[key],
          clientValue: undefined,
        });
      }
      continue;
    }
    
    // Get values
    const serverValue = serverState[key];
    const clientValue = clientState[key];
    
    // Apply custom comparator if available
    if (customComparators[key] || customComparators[currentPath]) {
      const comparator = customComparators[key] || customComparators[currentPath];
      if (!comparator(serverValue, clientValue)) {
        differences.push({
          path: currentPath,
          serverValue,
          clientValue,
        });
      }
      continue;
    }
    
    // Compare values based on their types
    if (typeof serverValue !== typeof clientValue) {
      differences.push({
        path: currentPath,
        serverValue,
        clientValue,
      });
    } else if (typeof serverValue === 'object' && serverValue !== null) {
      // Recurse for objects
      compareDeep(
        serverValue,
        clientValue,
        currentPath,
        ignoreFields,
        allowSubset,
        customComparators,
        differences
      );
    } else if (serverValue !== clientValue) {
      differences.push({
        path: currentPath,
        serverValue,
        clientValue,
      });
    }
  }
  
  // Check for extra keys in client state if not allowing subset
  if (!allowSubset) {
    for (const key in clientState) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // Skip ignored fields
      if (ignoreFields.includes(key) || ignoreFields.includes(currentPath)) {
        continue;
      }
      
      // Check if key doesn't exist in server state
      if (!(key in serverState)) {
        differences.push({
          path: currentPath,
          serverValue: undefined,
          clientValue: clientState[key],
        });
      }
    }
  }
}

/**
 * Shallow comparison of objects (only top-level keys)
 */
function compareShallow(
  serverState: Record<string, any>,
  clientState: Record<string, any>,
  ignoreFields: string[],
  allowSubset: boolean,
  customComparators: Record<string, (a: any, b: any) => boolean>,
  differences: Array<{ path: string; serverValue: any; clientValue: any }>
): void {
  // Check all keys in server state
  for (const key in serverState) {
    // Skip ignored fields
    if (ignoreFields.includes(key)) {
      continue;
    }
    
    // Check if key exists in client state
    if (!(key in clientState)) {
      if (!allowSubset) {
        differences.push({
          path: key,
          serverValue: serverState[key],
          clientValue: undefined,
        });
      }
      continue;
    }
    
    // Get values
    const serverValue = serverState[key];
    const clientValue = clientState[key];
    
    // Apply custom comparator if available
    if (customComparators[key]) {
      if (!customComparators[key](serverValue, clientValue)) {
        differences.push({
          path: key,
          serverValue,
          clientValue,
        });
      }
      continue;
    }
    
    // Compare values
    if (serverValue !== clientValue) {
      differences.push({
        path: key,
        serverValue,
        clientValue,
      });
    }
  }
  
  // Check for extra keys in client state if not allowing subset
  if (!allowSubset) {
    for (const key in clientState) {
      // Skip ignored fields
      if (ignoreFields.includes(key)) {
        continue;
      }
      
      // Check if key doesn't exist in server state
      if (!(key in serverState)) {
        differences.push({
          path: key,
          serverValue: undefined,
          clientValue: clientState[key],
        });
      }
    }
  }
}

export const StateComparer = {
  compareState,
};

export default StateComparer;