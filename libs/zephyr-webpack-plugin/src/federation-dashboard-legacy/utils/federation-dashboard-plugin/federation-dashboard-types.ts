export interface Source {
  source: () => Buffer;
  size: () => number;
}

export type Exposes = (string | ExposesObject)[] | ExposesObject;

interface ExposesObject {
  [index: string]: string | ExposesConfig | string[];
}

/**
 * Advanced configuration for modules that should be exposed by this container.
 */
interface ExposesConfig {
  /**
   * Request to a module that should be exposed by this container.
   */
  import: string | string[];

  /**
   * Custom chunk name for the exposed module.
   */
  name?: string;
}
