# Consumer task

An existing Vite application must publish through Zephyr without replacing its
framework configuration. Add the installed Zephyr integration and build the
application. Its publication must include the HTML, JavaScript, and public
configuration manifest exactly once. Keep production credentials and network
requests out of the local verification.

The grader must reject a config that builds local assets but never publishes.
For federation, verify that requesting the feature without its optional peer
fails with an actionable dependency error rather than breaking ordinary apps.

## Discovery cases

These prompts are inputs for a fresh consumer evaluation, not assertions that
discovery has already been verified.

Should load:

- "I have an existing Vite app. Add Zephyr deployment without changing its React setup."
- "My Vite host needs federation. Wire the Zephyr integration without creating duplicate containers."
- "My Vite client and server build separately. How do I publish the complete app once?"

Should not load:

- "Promote an existing Zephyr version to production without rebuilding."
- "Add Zephyr to my TanStack Start app using its supported framework integration."
- "Help me design a Module Federation release workflow across Rspack and Webpack projects."
