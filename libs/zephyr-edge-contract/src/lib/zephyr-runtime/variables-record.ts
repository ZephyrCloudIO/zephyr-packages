/**
 * A double-record structure to store environment variables for an application and its
 * remotes
 */
export type VariablesRecord = {
  [application_uid: string]: {
    [variableName: string]: string;
  };
};

export interface RequestMissingVariablesProps {
  application_uid: string;
  remotes: string[];

  /** A list of environment variable names used by the application */
  usedEnvNames: Iterable<string>;

  /** A map of environment variables that can be used to populate the variables record. */
  processEnv?: Record<string, string | undefined>;

  /**
   * A function that loads from a remote missing environment variables and set them in the
   * mutable variables record.
   */
  requestMissingVariables?: (
    this: void,
    missingNames: string[],
    remotes: string[],
    mutVariables: VariablesRecord
  ) => void | Promise<void>;
}

export interface RequestMissingVariablesResult {
  variables: VariablesRecord;
  /** Names that weren't found in processEnv and remote */
  missing: string[];
}

/**
 * Populates a variables record with environment variables for the given application and
 * its remotes.
 */
export async function createVariablesRecord({
  application_uid,
  remotes,
  usedEnvNames,
  processEnv,
  requestMissingVariables,
}: RequestMissingVariablesProps): Promise<RequestMissingVariablesResult> {
  const variables: VariablesRecord = { [application_uid]: {} };
  const missing: string[] = [];

  // Attempts to get missing values from process.env
  for (const key of usedEnvNames) {
    const value = processEnv?.[key];

    // Skip 0, '' and false values
    if (value === undefined || value === null) {
      missing.push(key);
    } else {
      variables[application_uid][key] ??= value;
    }
  }

  // If any variables are missing or we have remotes, we need to request them
  if (missing.length || remotes.length) {
    await requestMissingVariables?.(missing, remotes, variables);
  }

  return {
    variables,
    missing,
  };
}
