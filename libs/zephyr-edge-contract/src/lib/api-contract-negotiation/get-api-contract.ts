/* istanbul ignore file */
export const ZEPHYR_API_ENDPOINT = () =>
  process.env['ZE_API']?.length ? process.env['ZE_API'] : 'https://api.zephyr-cloud.io';

export const ZE_API_ENDPOINT = () =>
  process.env['ZE_API_GATE']?.length
    ? process.env['ZE_API_GATE']
    : 'https://zeapi.zephyrcloud.app';

export const ZE_API_ENDPOINT_HOST = () => new URL(ZE_API_ENDPOINT()).host;

export const ZE_IS_PREVIEW = () => process.env['ZE_IS_PREVIEW'] === 'true';

export const ze_api_gateway = {
  logs: '/logs',
  build_stats: '/build-stats',
  authorize_link: '/authorize-link',
  resolve: '/resolve',
  application_config: '/application-config',
  websocket: '/websocket',
  get_access_token_by_server_token: 'get-access-token-by-server-token',
};
