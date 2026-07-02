export declare function createSnapshotId(options: {
  app: {
    org: string;
    project: string;
    name: string;
  };
  zeConfig: {
    user: string;
    buildId: string;
  };
}): string;
export declare function flatCreateSnapshotId(props: {
  org: string;
  project: string;
  name: string;
  username: string;
  buildId: string;
}): string;
