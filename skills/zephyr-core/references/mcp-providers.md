# MCP providers (skills and tools for the Zephyr MCP)

Read this when the user wants to publish agent skills or tools to their
organization's Zephyr MCP (`mcp.zephyr-cloud.io/mcp`), asks why a deploy became
private, or hits an MCP deploy error. Command details live in the `zephyr-cli`
skill.

## Model

- A version whose output root contains `mcp-provider.json` is an MCP provider. It
  is a private snapshot: the edge returns 404 for every anonymous read of it, and
  only the Zephyr MCP reads its files with short-lived tokens.
- Releasing the version to an environment in Zephyr serves its skills and tools to
  every engineer's agent in the organization (behind the `federated-mcp` flag).
  Tags, environments, and rollback work as for any version.
- An application is either an MCP provider or not; the API rejects mixing.

## Repo shapes

- Skills repo: `skills/<skill-name>/SKILL.md` with `references/`, `assets/`,
  `scripts/`, and optional `evals/evals.json`. No `package.json` is needed. Deploy
  with `npx zephyr-cli deploy .`.
- Tools repo: `tools/<tool_name>.ts`, a `package.json` depending on
  `@module-federation/mcp`, built with its Rslib preset into `dist/`. Deploy with
  `npx zephyr-cli deploy dist`.
- Every skill needs frontmatter `name` (equal to the folder), `description`, and
  `metadata.owner` and `metadata.contact`. Run `npx zephyr-cli doctor .` for the
  ZD07xx checks before deploying.

## What gets uploaded

Only `mcp-provider.json`, `catalog.json`, the skill files the catalog lists, and
`tools/index.js`. Evals, source maps, dotfiles, `node_modules`, and TypeScript under
`tools/` are rejected by zephyr-agent, and `tools/index.js` must be one bundled file
with no imports or `node:`/`cloudflare:` specifiers (ZD0741). Every served `SKILL.md`
must parse to the frontmatter its catalog entry records (ZD0741), whichever tool
uploads it. Each skill holds at most 512 files and 16 MiB
in total, at most 5 MiB per file (ZD0719). Eval results from CI (`--eval-results`) travel only in
build stats and are stored with the version, never on the edge.

## Requirements and failures

- The application must deploy to the default Zephyr Cloudflare edge with no extra
  environment edges; otherwise the deploy fails closed before uploading.
- `baseHref` must be empty or `/`.
- A skills repo is named from `zephyr.config` `appName`, else its git repository,
  else its directory, at version `0.0.0`; a parent `package.json` is never used.
- When the API rejects the version, the error lists the rejected field paths
  (`ERR_DEPLOY_LOCAL_BUILD`), never their values.
