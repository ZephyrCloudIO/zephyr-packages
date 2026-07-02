export declare const ZEPHYR_API_ENDPOINT: () => string;
export declare const ZE_API_ENDPOINT: () => string;
export declare const ZE_API_ENDPOINT_HOST: () => string;
export declare const ZE_IS_PREVIEW: () => boolean;
export declare const ZE_ENV: () => string | undefined;
export declare const ze_api_gateway: {
  logs: string;
  build_stats: string;
  authorize_link: string;
  resolve: string;
  application_config: string;
  websocket: string;
  get_access_token_by_server_token: string;
  ci_token_exchange: string;
};
