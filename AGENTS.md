# Agent Skills

Agent Skills live in `skills/<name>/SKILL.md`: `zephyr-core`,
`zephyr-module-federation`, `zephyr-cli`, and `create-zephyr-apps`. Each
bundler or framework integration has a guide in
`skills/zephyr-core/references/integrations/<stack>.md`, listed in the
`zephyr-core` routing table. Packages do not ship skills; users install them
from this repository with `npx skills add ZephyrCloudIO/zephyr-packages`.

When a change alters a package's setup, options, or behavior, update its guide
or skill in the same PR. Keep frontmatter to the Agent Skills fields (`name`,
`description`, `license`, `compatibility`, `metadata`, `allowed-tools`), keep
links inside the skill directory, and add a row to the routing table for a new
integration. Run `pnpm skills:check` before handing off.
