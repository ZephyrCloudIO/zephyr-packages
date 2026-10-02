# Gotchas

Use this file when the user is stuck or their MF setup looks valid but still fails.

## Common issues

### Remotes built after host

- Zephyr usually needs remotes available first to resolve them cleanly.
- In cyclic setups, users may need a staged build process.

### Naming mismatch

Keep names aligned across:

- remote `package.json` `name`
- MF config `name`
- host remotes keys / import names
- `zephyr:dependencies` keys and targets

If these drift, resolution and runtime loading become fragile fast.

### Mixed-bundler remote type mismatch

- Vite module remotes often use `type: 'module'`
- Webpack/Rspack-style remotes may use `type: 'var'`
- If the user picks the wrong type, the host may fail to load the remote at runtime even if the deploy succeeded.

### Vite-specific MF caveats

- Plugin order can matter in Vite MF setups; do not assume Zephyr should always be the last plugin.
- `build.target` may need to account for top-level await support in MF setups.
- `modulePreload` behavior can matter for cross-bundler Vite setups.
- Use the Zephyr Vite MF docs/examples when debugging these issues rather than generic plugin-order guesses.

### Hardcoded URLs left in place

- Hardcoded localhost URLs are fine for local example configs.
- For Zephyr answers, steer the user toward Zephyr dependency resolution rather than manually swapping production remote URLs.

### Git and access still matter

- MF setup can be correct while deployment still fails because git context or app access is missing.

### Missing remote environment fallback

- `workspace:*` and other selectors can still fail if the remote app has never been built into a resolvable environment/default path.
- If resolution fails, check that the remote was built first and that Zephyr has a fallback environment to resolve.

## Quick diagnostic flow

1. If the host cannot find the remote at all, check naming alignment first.
2. If naming is correct but Zephyr cannot resolve the remote target, check selector choice and whether the remote was built into a resolvable environment.
3. If resolution succeeds but runtime loading still breaks, check remote `type`, Vite MF caveats, and bundler compatibility.
