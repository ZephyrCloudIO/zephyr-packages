``; // import { UploadProviderType } from '../../../../zephyr-agent/src/lib/node-persist/upload-provider-options';
import { ZeErrors, ZephyrError } from 'zephyr-agent';
import { ZephyrEngine } from 'zephyr-agent';

const valid_identifiers = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
// Fastly doesn't allow underscore in domains, reference: https://datatracker.ietf.org/doc/html/rfc1035#:~:text=The%20labels%20must%20follow%20the%20rules%20for%20ARPANET%20host%20names.%20%20They%20must%0Astart%20with%20a%20letter%2C%20end%20with%20a%20letter%20or%20digit%2C%20and%20have%20as%20interior%0Acharacters%20only%20letters%2C%20digits%2C%20and%20hyphen.%20%20There%20are%20also%20some%0Arestrictions%20on%20the%20length.%20%20Labels%20must%20be%2063%20characters%20or%20less.
const valid_identifier_fastly = /^[a-zA-Z$][a-zA-Z0-9$]*$/;

interface RemotesConfig {
  /** Container locations from which modules should be resolved and loaded at runtime. */
  external: string | string[];

  /** The name of the share scope shared with this remote. */
  shareScope?: string;
}
interface RemotesObject {
  [index: string]: string | RemotesConfig | string[];
}
interface KnownMfConfig {
  config?: {
    name: string;
    library?: {
      type?: string;
    };
    remotes?: (string | RemotesObject)[] | RemotesObject;
  };
}

export async function verify_mf_fastly_config(
  mf_configs: KnownMfConfig[] | undefined,
  zephyr_engine: ZephyrEngine
) {
  if (!mf_configs) return;

  await zephyr_engine.application_configuration;

  for (const mf_config of mf_configs) {
    const mfConfig = mf_config.config;

    if (!mfConfig) return;

    const condition =
      mfConfig?.library?.type === 'var' || typeof mfConfig?.library?.type === 'undefined';

    if (
      condition &&
      !valid_identifiers.test(mfConfig?.name)
      // && platform === UploadProviderType.FASTLY
    ) {
      throw new ZephyrError(ZeErrors.ERR_INVALID_MF_CONFIG, {
        cause: ZeErrors.ERR_INVALID_MF_CONFIG.message.replace(
          '{{library_name}}',
          mfConfig.name
        ),
      });
    }

    // Verify fastly config

    const fastly_condition =
      !valid_identifier_fastly.test(mfConfig.name) ||
      !valid_identifier_fastly.test(zephyr_engine.application_uid);

    if (
      condition &&
      !fastly_condition
      // && platform === UploadProviderType.FASTLY
    ) {
      throw new ZephyrError(ZeErrors.ERR_INVALID_APP_ID, {
        cause: ZeErrors.ERR_INVALID_APP_ID.message.replace(
          '{{application_uid}}',
          zephyr_engine.application_uid
        ),
      });
    }
  }
}
