// TODO: it is a draft, will be updated in future
// import { unstable_pages } from 'wrangler';
// import { Cloudflare } from 'cloudflare';
// import * as process from 'process';
//
// import { UploaderInterface } from '../uploader.interface';
//
// export class CloudflarePagesStrategy implements UploaderInterface {
//   async upload(directory: string, options: Options): Promise<void> {
//     const {cloudflareKey, accountId, appName} = options;
//     process.env['CLOUDFLARE_API_KEY'] = cloudflareKey;
//     const client = new Cloudflare();
//     const project: Cloudflare.Pages.Project | undefined = await client.pages.projects.get(appName, {account_id: accountId});
//     if (!project) {
//       await client.pages.projects.create({
//         account_id: accountId,
//         name: appName,
//       }) as unknown as Cloudflare.Pages.Project;
//     }
//
//     await unstable_pages.deploy({
//       directory,
//       accountId,
//       projectName: appName,
//     });
//   }
// }
//
// export interface Options {
//   cloudflareKey: string;
//   accountId: string;
//   appName: string;
// }

// import { CloudflarePagesStrategy } from './strategies/cloudflare-pages-strategy';
//
// async function upload(directory: string, platform: DeploymentIntegrationPlatform): Promise<void> {
//   switch (platform) {
//     case DeploymentIntegrationPlatform.CLOUDFLARE:
//       return new CloudflarePagesStrategy().upload(directory, {});
//   }
//
//   throw new Error(`${platform} integration is not implemented yet.`);
// }
//
// export enum DeploymentIntegrationPlatform {
//   CLOUDFLARE = 'cloudflare',
//   AWS = 'aws',
//   NETLIFY = 'netlify',
//   AZURE = 'azure',
//   GCP = 'gcp',
// }

// export interface UploaderInterface {
//   upload(directory: string, options: unknown): Promise<void>;
// }


