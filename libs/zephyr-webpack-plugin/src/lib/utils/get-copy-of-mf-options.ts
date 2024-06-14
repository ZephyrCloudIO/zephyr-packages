// eslint-disable-next-line
import { Configuration } from 'webpack';
import { isModuleFederationPlugin } from './is-mf-plugin';

export function getCopyOfMFOptions(config: Configuration): unknown | Array<unknown> {
  return config.plugins
    ?.filter(isModuleFederationPlugin)
    .map((mf: unknown) => {
      const _mf = mf as { _options: unknown };
      if (!_mf?._options) return;

      return JSON.parse(JSON.stringify(_mf._options));
    })
    .filter(Boolean);
}
