# Agent Skills

Agent Skills for these packages live in
[ZephyrCloudIO/skills](https://github.com/ZephyrCloudIO/skills). Each bundler
or framework integration has a guide in
`skills/zephyr-core/references/integrations/<stack>.md` there. When a change
alters a package's setup, options, or behavior, open a matching pull request
in that repository to update its guide or skill.

# Configuration options

New user-facing options go in `zephyr.config.*`, not in an integration's
`withZephyr(...)` parameters. The shared loader in
`libs/zephyr-agent/src/lib/build-context/zephyr-config.ts` parses and validates every
field: add it to `CONFIG_FIELDS` and `parseConfig`, expose the parsed value on
`ResolvedZephyrConfig`, and cover it in `__test__/zephyr-config.test.ts`.
Integrations read it from `zephyr_engine.zephyrConfig`.

Types: fields every integration accepts go in `ZephyrConfig` (zephyr-agent).
Fields only some integrations act on are typed in a shared package for those
integrations (for example `ZephyrNativeConfig` in zephyr-native-internal) or in the
integration itself. Each integration exports its config type,
`Zephyr<Integration>Config` (for example `ZephyrMetroConfig` from
zephyr-metro-plugin), and re-exports the shared types it builds on. Users import
config types only from their integration. List new fields in `docs/git-usage.md`.
Existing `withZephyr` parameters stay as they are.
