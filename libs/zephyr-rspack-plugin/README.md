# Zephyr: We made application federation easy

readme too be released

how to use?

with Nx and Rspack

```
export default composePlugins(
  withNx(),
  withReact(),
  withModuleFederation(mfConfig),
  withZephyr(),
  (config) => {
    return config;
  }
);
```

or

```
module.exports = withZephyr()(your_rspack_config);

```
