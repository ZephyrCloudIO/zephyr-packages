# Zephyr Agent Skills

These Agent Skills teach AI coding agents how to set up, deploy, and debug
applications with [Zephyr Cloud](https://zephyr-cloud.io). Zephyr does not
need them at runtime.

## Install

Install them with the [`skills` CLI](https://github.com/vercel-labs/skills).
It works with Claude Code, Codex, Cursor, and other agents.

```sh
# Pick skills from an interactive list
npx skills add ZephyrCloudIO/zephyr-packages

# Install specific skills
npx skills add ZephyrCloudIO/zephyr-packages --skill zephyr-core --skill zephyr-vite

# List the available skills without installing
npx skills add ZephyrCloudIO/zephyr-packages --list
```

Install `zephyr-core` with the skill for your bundler or framework. Add
`zephyr-module-federation` if you use Module Federation.

## Skills

| Skill                      | Package                             |
| -------------------------- | ----------------------------------- |
| `zephyr-core`              | Shared Zephyr setup and deployment  |
| `zephyr-module-federation` | Shared Module Federation on Zephyr  |
| `create-zephyr-apps`       | `create-zephyr-apps`                |
| `zephyr-cli`               | `zephyr-cli`                        |
| `zephyr-astro`             | `zephyr-astro-integration`          |
| `zephyr-metro`             | `zephyr-metro-plugin`               |
| `zephyr-modernjs`          | `zephyr-modernjs-plugin`            |
| `zephyr-nuxt`              | `zephyr-nuxt-module`                |
| `zephyr-parcel`            | `parcel-reporter-zephyr`            |
| `zephyr-repack`            | `zephyr-repack-plugin`              |
| `zephyr-rolldown`          | `zephyr-rolldown-plugin`            |
| `zephyr-rollup`            | `rollup-plugin-zephyr`              |
| `zephyr-rsbuild`           | `zephyr-rsbuild-plugin`             |
| `zephyr-rspack`            | `zephyr-rspack-plugin`              |
| `zephyr-rspress`           | `zephyr-rspress-plugin`             |
| `zephyr-tanstack-start`    | `vite-plugin-tanstack-start-zephyr` |
| `zephyr-vinext`            | `vite-plugin-vinext-zephyr`         |
| `zephyr-vite`              | `vite-plugin-zephyr`                |
| `zephyr-webpack`           | `zephyr-webpack-plugin`             |

## Contributing

Each skill lives in `skills/<name>/SKILL.md`. When a change alters a
package's setup, options, or behavior, update its skill in the same pull
request and run `pnpm skills:check`.
