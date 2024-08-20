export const ZEPHYR_API_ENDPOINT = () => process.env['ZE_API'] ?? 'https://api.zephyr-cloud.io';

export const ZE_API_ENDPOINT = () => process.env['ZE_API_GATE'] ?? 'https://zeapi.zephyrcloud.app';

export const ze_api_gateway = {
  logs: '/logs',
  build_stats: '/build-stats',
  auth_link: '/auth-link',
  resolve: '/resolve',
  application_config: '/application-config',
};
