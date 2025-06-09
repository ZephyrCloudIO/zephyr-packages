import type { ZephyrEngine } from 'zephyr-agent';

export interface ZephyrRspressPluginOptions {
  deferEngine: Promise<ZephyrEngine>;
  root: string;
  files: string[];
}

export interface Stats {
  compilation: {
    options: {
      context: string;
      [key: string]: any;
    };
    assets?: {
      name: string;
      size?: number;
      info?: {
        [key: string]: any;
      };
    }[];
    [key: string]: any;
  };
  toJson: (options?: any) => {
    assets?: {
      name: string;
      size?: number;
      emitted?: boolean;
      chunkNames?: string[];
      info?: {
        minimized?: boolean;
        related?: Record<string, string[]>;
        [key: string]: any;
      };
      [key: string]: any;
    }[];
    errors?: any[];
    warnings?: any[];
    outputPath?: string;
    [key: string]: any;
  };
}
