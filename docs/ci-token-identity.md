---
summary: Describes plugin-side CI actor inference for ZE_CI_TOKEN attribution.
read_when:
  - Changing ZE_CI_TOKEN auth, CI actor attribution, GitLab CI support, or adding a CI provider adapter.
---

# CI Token Identity

CI token attribution is inferred in `zephyr-agent`, not in cloud services. This keeps self-hosted CI providers working
even when Zephyr Cloud cannot reach the customer's internal CI server. The flow is opt-in through `ZE_CI_TOKEN`; the legacy
`ZE_SERVER_TOKEN` behavior is unchanged.

The extension point is `ciIdentityProviders` in
`libs/zephyr-agent/src/lib/node-persist/ci-token-identity.ts`.

Each provider adapter:

1. Detects its CI environment from predefined variables.
2. Infers a user email from provider-native job identity data, using provider APIs from the runner when needed.
3. Sends `{ provider, email, source }` to `POST /v2/ci-token/exchange` on cloud-io.

GitLab is the first adapter. It reads `CI_JOB_TOKEN` as a JWT when possible and extracts `user_email` or `email`. If the
token is legacy/non-JWT or has no email claim, it calls the inferred GitLab API v4 `/job` endpoint from the plugin using
`CI_JOB_TOKEN`. If the API is unavailable, it falls back to GitLab's predefined `GITLAB_USER_EMAIL`. When job, project,
or pipeline IDs are available from JWT claims or the `/job` response, they must match `CI_JOB_ID`, `CI_PROJECT_ID`, and
`CI_PIPELINE_ID`.

Cloud-io does not call GitLab for this flow; provider-specific validation stays in the plugin. The plugin calls
ze-api-gateway's `ci-token-exchange` route, which proxies to cloud-io and does not use worker-auth. Cloud-io validates
the CI token against its separate CI-token table and mints a short-lived Zephyr CI access token.
