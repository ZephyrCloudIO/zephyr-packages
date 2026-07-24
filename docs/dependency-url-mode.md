---
summary: Describes mutable selector and immutable version URL output for zephyr dependencies.
read_when:
  - Changing zephyr:dependencies resolution, Zephyr resolver requests, or Module Federation remote URL output.
---

# Dependency URL Mode

Zephyr resolves each `zephyr:dependencies` reference before the bundler finalizes its
Module Federation configuration. Selection and URL identity are separate concerns: a
tag, environment, or `workspace:*` reference can select an application version while
the emitted remote URL either follows that mutable selector or points directly at the
selected immutable version.

Selector URLs remain the default for backward compatibility. Opt into immutable URLs
through the project-level Zephyr config:

```ts
import { defineConfig } from 'zephyr-agent';

export default defineConfig({
  dependencyUrlMode: 'version',
});
```

`version` mode applies to all resolved remote URL fields: the deployment root,
`remote_entry_url`, and `manifest_url`. Switching only the remote entry is insufficient
because enhanced Module Federation runtimes prefer the manifest URL when one exists.

The selector still controls which deployment wins. For example, `staging` selects the
version currently assigned to the staging environment at host build time, then embeds
that version's immutable URLs. Moving staging later does not change the already-built
host.
