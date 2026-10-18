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
npx skills add ZephyrCloudIO/zephyr-packages --skill zephyr-core --skill zephyr-module-federation

# List the available skills without installing
npx skills add ZephyrCloudIO/zephyr-packages --list
```

Most projects need only `zephyr-core`. Add `zephyr-module-federation` if the
application uses Module Federation.

## Skills

| Skill                      | Use it for                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `zephyr-core`              | Adding Zephyr to an app, configuring its bundler or framework integration, versions, tags, environments |
| `zephyr-module-federation` | Hosts, remotes, `zephyr:dependencies`, and remote resolution                                            |
| `zephyr-cli`               | Publishing build output with `ze-cli` when there is no bundler integration                              |
| `create-zephyr-apps`       | Scaffolding a new Zephyr project                                                                        |

`zephyr-core` has a guide for every integration in
[`zephyr-core/references/integrations/`](./zephyr-core/references/integrations):
Vite, TanStack Start, Vinext, webpack, Rspack, Rsbuild, Modern.js, Rspress,
Rollup, Rolldown, Parcel, Astro, Nuxt, Metro, and Re.Pack. The agent reads only
the guide that matches the project's stack.

## Contributing

Each skill lives in `skills/<name>/SKILL.md`. Integration guides live in
`skills/zephyr-core/references/integrations/<stack>.md` and are listed in the
`zephyr-core` routing table. When a change alters a package's setup, options,
or behavior, update its guide in the same pull request and run
`pnpm skills:check`.
