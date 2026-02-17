# nitro-preset-cloudflare example

Nitro 3 app using `zephyr-nitro-preset` with custom options and `cloudflare_module` base preset.
When authenticated with Zephyr, `pnpm build` uploads the Nitro server output and prints the Zephyr deployment URL.

## Build and verify preset output

```bash
pnpm -C examples/nitro-preset-cloudflare build
cat examples/nitro-preset-cloudflare/.output/server/.zephyr/cloudflare-build.json
```

## Demo endpoints

```bash
curl "$URL/"
curl "$URL/health"
curl "$URL/time"
curl "$URL/echo?message=hello"
curl "$URL/demo/routes"
```
