// TODO: Replace with Auth0 production values

const api_env = process.env['ZE_DEV'] ?? 'prod';

interface ApiConfig {
  AUTH0_CLIENT_ID: string;
  AUTH0_DOMAIN: string;
  ZEPHYR_API_ENDPOINT: string;
}

const api_local_config: ApiConfig = {
  AUTH0_CLIENT_ID: 'ZsqL3PcPd5Tt2mNZimgvF5SRvvwvYqza',
  AUTH0_DOMAIN: 'zephyr-dev-eu.eu.auth0.com',
  ZEPHYR_API_ENDPOINT: 'http://localhost:3333',
};

const api_dev_config: ApiConfig = {
  AUTH0_CLIENT_ID: 'ZsqL3PcPd5Tt2mNZimgvF5SRvvwvYqza',
  AUTH0_DOMAIN: 'zephyr-dev-eu.eu.auth0.com',
  ZEPHYR_API_ENDPOINT: 'https://api-dev.zephyr-cloud.io',
};

const api_prod_config: ApiConfig = {
  AUTH0_CLIENT_ID: 'Bid9zSuXbsHFOHahQK8RlycTsEh1dJ00',
  AUTH0_DOMAIN: 'https://dev-dauyheb8iq6ef5la.us.auth0.com',
  ZEPHYR_API_ENDPOINT: 'https://api.zephyr-cloud.io',
};

export const environment: ApiConfig = ((env: string) => {
  switch (env) {
    case 'local':
      return api_local_config;
    case 'dev':
      return api_dev_config;
    default:
      return api_prod_config;
  }
})(api_env);

export default environment;
