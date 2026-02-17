export default function rootRouteHandler() {
  return {
    ok: true,
    preset: 'cloudflare_module',
    source: 'nitro-preset-cloudflare-example',
    endpoints: ['/', '/health', '/time', '/echo?message=hi', '/demo/routes'],
  };
}
