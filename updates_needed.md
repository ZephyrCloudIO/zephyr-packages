I want you to create a detailed plan and MDC based on the "updates needed" below. 
Before proposing a plan, ask at least 4 clarifying questions based on your findings, maximum 10 questions. If you need access to other codebases or are documentation ask, this does not count as a question count.
Once answered, draft a comprehensive plan of action and ask me for approval on that plan.
If feedback is provided, revise the plan and ask for approval again. Once approved, implement all steps in that plan.
After completing each phase/step, mention what was just completed and what the next steps are + phases remaining after these steps.

## Updates Needed

1) We need the ability to support both module federation 1.0 and 2.0. This means that the ability to use mf-manifest and runtime plugins needs to be added.
2) We need to create new examples for Rspack that show module federation 2.0
3) We need to create new examples for Vite 6.0 with Rolldown using module federation 2.0 (the example https://github.com/zackarychapple/rolldown-vite-module-federation-example is our base)
4) We need to add both of these new examples to our test matrix
5) We need to add unit tests that validate configuration for non module federation applications, module federation 1.0, and module federation 2.0 examples
6) We need to make enhancements to the engine and plugins to support package json names like `@rolldown-vite-module-federation-example/remote`. Most likely we will need to url encode the name to support this syntax
7) We need to create a plan on how to share information on the structure of the remote entry (MF 1.0 or 2.0) as well as tech stack of the remote (angular or react for example)
8) We need to review how the usage of ~/.zephyr is being used and how to update it when package.json information changes
9) We need to evaluate the differences between the mf-manifest.json format and the zephyr manifest format. If there are differences we need to provide a plan to add support for the current mf-manifest.json format.
10) We need the ability to manage version overrides of libraries, this is supported in MF 2.0 where you can override a version of a downstream dependency like react or react-dom 
11) We need the ability to have fallbacks for remotes, first version comes from Zephyr, if it fails to be fetched or fails to init we need to pull the previous version from zephyr, or have an alternative path (url or local) we can get the remote from
12) Remotes may be coming from a fully qualified (non localhost) URL like `webpack: 'webpack@https://unpkg.com/rolldown-mf-webpack-remote@1.0.0/dist/remoteEntry.js',` in this case we need to treat it as "unmanaged" by Zephyr make sure that use case is accounted for
13) We need to make sure the package.json files for each of the remotes is processed, as well as support for pnpm and yarn workspaces, so we can accurate determine versions of dependencies
14) We need to understand dependencies in Nx workspaces better and have some suggestions on how to improve the Nx name resolution with Module Federation and Zephyr
15) We need to add support for baseHref that is provided as part of a configuration
16) We will be adding support for server side as well for React Server, RSC, ISR, this will be for Vite and other frameworks, consider that as you plan
17) We will need the ability to import versions of remotes with Semver for example `remote@^1.2.1` or `remote@latest`. We should follow the semver standards 
18) We need the ability to understand if a remote is csr or ssr
19) We need the ability to upload additional telemetry and connect it to a version and a remote, for example, test runs, Rsdoctor output

## New issues 3/4/2025
1) Vite does not require a public directory at the root, however the vite plugin requires it, make this optional
2) The vite mf2 example is not properly generating mf types and sharing them (manually created a remote-declarations.d.ts to get around this, it should be removed after issue fixed)
3) The vite mf2 example has the following error that needs to be fixed
```js
index3.js:242 Error: [ Federation Runtime ]: Failed to locate remote. #RUNTIME-004
args: {"hostName":"host","requestId":"remote/Button"}
https://module-federation.io/guide/troubleshooting/runtime/RUNTIME-004
  at error (host__mf_v__runtimeInit__mf_v__.js:1192:12)
  at assert (host__mf_v__runtimeInit__mf_v__.js:1184:10)
  at RemoteHandler.getRemoteModuleAndOptions (host__mf_v__runtimeInit__mf_v__.js:3822:10)
  at async RemoteHandler.loadRemote (host__mf_v__runtimeInit__mf_v__.js:3724:65)
  Li @ index3.js:242
  Ni.c.callback @ index3.js:242
  sh @ index3.js:210
  kk @ index3.js:315
  ik @ index3.js:313
  hk @ index3.js:312
  Wk @ index3.js:336
  Pk @ index3.js:334
  Gk @ index3.js:322
  J @ index3.js:44
  R @ index3.js:45Understand this errorAI
index3.js:336 Uncaught Error: [ Federation Runtime ]: Failed to locate remote. #RUNTIME-004
args: {"hostName":"host","requestId":"remote/Button"}
https://module-federation.io/guide/troubleshooting/runtime/RUNTIME-004
  at error (host__mf_v__runtimeInit__mf_v__.js:1192:12)
  at assert (host__mf_v__runtimeInit__mf_v__.js:1184:10)
  at RemoteHandler.getRemoteModuleAndOptions (host__mf_v__runtimeInit__mf_v__.js:3822:10)
  at async RemoteHandler.loadRemote (host__mf_v__runtimeInit__mf_v__.js:3724:65)
```
