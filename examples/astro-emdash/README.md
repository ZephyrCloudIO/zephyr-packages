# Astro and EmDash Cloudflare fixture

Builds a real EmDash CMS using published packages, the Cloudflare adapter, D1,
R2, and Zephyr's Astro integration. The Worker preserves EmDash's scheduled
maintenance handler and plugin bridge export.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm exec turbo run build --filter=zephyr-astro-integration...
ZE_DISABLED=true pnpm --filter astro-emdash build
pnpm --filter astro-emdash preview
```

The preview uses local resources and automatic local migrations. Open the
reported local URL, then `/_emdash/admin` for setup. Test maintenance at
`/cdn-cgi/handler/scheduled?cron=*+*+*+*+*`. Stop preview with Ctrl-C.

Inspect completed output without uploading:

```sh
node --input-type=module -e "import {collectCloudflareOutput} from './libs/zephyr-astro-integration/dist/index.mjs'; const o = await collectCloudflareOutput('./examples/astro-emdash'); console.log({entrypoint:o.entrypoint, files:Object.keys(o.assetsMap).length, requirements:o.deployment});"
```

The collector follows the adapter's generated deployment pointer, verifies the
module graph, and collects server chunks plus client files. The requirement
description excludes resource IDs and variable values; the generated Wrangler
config is not uploaded as a public asset.

Remote publication requires a Zephyr runtime advertising
`capabilities.cloudflareDeployment: 1`, with real support for the declared
bindings, static assets, compatibility flags, and scheduled events. Existing
managed SSR support alone does not establish those capabilities. Running
`pnpm --filter astro-emdash run deploy` fails before upload when the runtime
does not support the contract. Do not bypass the check or deploy this fixture
directly with Wrangler as a substitute for the Zephyr proof.

Before an authorized remote deployment, provision environment-owned resources,
apply the matching `.emdash/migrations.json` to the reviewed database, and
configure the final CMS origin and runtime secrets. Production runtime migration
mode is `check`. The native EmDash admin/API remains on `/_emdash`; website
content publication and environment release require their separate application
workflow described in the approved implementation plan.
