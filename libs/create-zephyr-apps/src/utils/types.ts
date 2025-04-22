export interface GithubTreeItem {
  path: string;
  type: 'tree' | 'blob';
}

export interface ExampleMetadata {
  name: string;
  description: string;
  path: string;
}

export interface WebCreationOptions {
  path: string;
  template: string;
  framework: string;
}

export interface ReactNativeCreationOptions {
  path: string;
  // host_name: string;
  //  remote_names: string[];
}

export interface CLIOptions {
  path: string;
  type: 'web' | 'react-native';
  /**
   * At the moment, if users opt for web they will only be asked for a template without
   * host name and remote_name
   */
  templates: string | undefined;
  //host_name: string | undefined;
  //remote_names: string[] | undefined;
  install: boolean;
}
