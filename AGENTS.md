# Agent Skills

Agent Skills live in `skills/<name>/SKILL.md`, one per published build
integration plus the shared `zephyr-core` and `zephyr-module-federation`
guides. Packages do not ship them; users install them from this repository
with `npx skills add ZephyrCloudIO/zephyr-packages`.

When a change alters a package's setup, options, or behavior, update its skill
in the same PR. Keep frontmatter to the Agent Skills fields (`name`,
`description`, `license`, `compatibility`, `metadata`, `allowed-tools`), keep
links inside the skill directory, and register a new package skill's
`SKILL.md` in `release-please-config.json` extra-files. Run
`pnpm skills:check` before handing off.
