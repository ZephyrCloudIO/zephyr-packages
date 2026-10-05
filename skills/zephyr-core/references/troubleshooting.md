# Troubleshooting

Use this file for common Zephyr setup and build failures.

## First checks

- Confirm the stack is using the right SDK/plugin.
- Confirm the project is a git repo with a remote, branch, and commit.
- Confirm the user is authenticated and has access to the target app/org.
- Confirm the Zephyr integration is attached to the actual build config being executed.

## Common failure classes

### Wrong plugin for the stack

- Vite -> `vite-plugin-zephyr`
- Rspack -> `zephyr-rspack-plugin`
- Webpack -> `zephyr-webpack-plugin`
- TanStack Start, Vinext, Astro, Rspress, Nuxt, Nitro -> prefer their dedicated integration paths

### Git context missing

Common symptoms:

- app identity cannot be resolved
- build ID / auth / application UID errors
- deployment metadata is incomplete

### Auth/access mismatch

Common symptoms:

- login succeeds locally but deploy cannot write
- CI token works for one org/app but not another
- build accepts config but publish fails later

### Docs drift to call out

- If Rspack docs and examples disagree, prefer `zephyr-rspack-plugin` from the SDK picker and examples.
- Public docs around status names have some drift; keep answers focused on immutable versions plus mutable routing targets.

## Good error docs

- Error index: `https://docs.zephyr-cloud.io/errors.md`
- Git remote missing: `https://docs.zephyr-cloud.io/errors/ze10014.md`
- Git config missing: `https://docs.zephyr-cloud.io/errors/ze10016.md`
- Auth error: `https://docs.zephyr-cloud.io/errors/ze10018.md`
- Build ID failure: `https://docs.zephyr-cloud.io/errors/ze10019.md`
