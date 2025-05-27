export type ZephyrEngineBuilderTypes =
  | 'webpack'
  | 'rspack'
  | 'repack'
  | 'vite'
  | 'rollup'
  | 'parcel'
  | 'unknown';

export interface ZephyrEngineOptions {
  context: string | undefined;
  builder: ZephyrEngineBuilderTypes;
}

export interface ZephyrEngineInterface<T = unknown> {
  create(options: ZephyrEngineOptions): Promise<T>;
}

export type DeferredZephyrEngine<T = unknown> = {
  zephyr_engine_defer: Promise<T>;
  zephyr_defer_create(options: ZephyrEngineOptions): void;
};

export function defer_create_zephyr_engine<T>(
  ZephyrEngineClass: ZephyrEngineInterface<T>
): DeferredZephyrEngine<T> {
  let resolve: (value: T) => void;
  let reject: (reason?: unknown) => void;

  return {
    zephyr_engine_defer: new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    }),

    zephyr_defer_create(options: ZephyrEngineOptions) {
      ZephyrEngineClass.create(options).then(resolve, reject);
    },
  };
}
