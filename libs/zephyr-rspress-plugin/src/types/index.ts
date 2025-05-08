import { ZephyrEngine } from 'zephyr-agent';

export interface ZephyrRspressPluginOptions {
  deferEngine: Promise<ZephyrEngine>;
  root: string;
  files: string[];
}

export interface Stats {
  compilation: {
    options: {
      context: string;
    };
  };
  toJson: () => {
    assets: { name: string }[];
  };
}
