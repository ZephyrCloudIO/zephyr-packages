import { CloudflareOptions, ze_error } from 'zephyr-edge-contract';
import process from 'process';

export async function upload(outputPath: string, { api_token, accountId, projectName }: CloudflareOptions): Promise<string> {
  process.env['CLOUDFLARE_API_TOKEN'] = api_token;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const wrangler = require('wrangler');

  if (!wrangler) {
    ze_error(
      'ERR_NO_WRANGLER',
      'Wrangler dependency is needed for Cloudflare deployment. Please install dependencies without --no-optional flag.'
    );
    throw new Error('Wrangler dependency not installed.');
  }

  const result = await wrangler.unstable_pages.deploy({
    directory: outputPath,
    accountId,
    projectName: projectName as string,
  });

  process.env['CLOUDFLARE_API_TOKEN'] = undefined;

  return result.url;
}
