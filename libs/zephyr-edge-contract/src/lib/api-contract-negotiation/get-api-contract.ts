export const ZEPHYR_API_ENDPOINT =
  process.env['ZE_API'] ?? 'https://api.zephyr-cloud.io';

export const v2_api_paths = {
  dashboard_path: '/v2/builder-packages-api/upload-from-dashboard-plugin',
  resolve_dependency_path: '/v2/builder-public-api/resolve',
  authorize_link: '/v2/authorize-link',
  application_configuration: '/v2/builder-packages-api/application-config',
};
