export interface ZephyrNextJSPluginOptions {
  // Optional flag to wait for index.html processing
  wait_for_index_html?: boolean;
  
  // NextJS specific options
  deployOnClientOnly?: boolean; // If true, only deploy on client build
  preserveServerAssets?: boolean; // If true, preserve server build assets
}