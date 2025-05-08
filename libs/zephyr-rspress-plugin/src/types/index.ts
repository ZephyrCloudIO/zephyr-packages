export interface ZephyrRspressPluginOptions {
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
