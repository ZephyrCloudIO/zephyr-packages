---
summary: Describes plugin-side CI actor inference for ZE_CI_TOKEN attribution.
read_when:
  - Changing ZE_CI_TOKEN auth, CI actor attribution, GitLab/GitHub CI support, or adding a CI provider adapter.
---

# CI Token Identity

CI token attribution is inferred in `zephyr-agent`, not in cloud services. This keeps self-hosted CI providers working
even when Zephyr Cloud cannot reach the customer's internal CI server. The flow is opt-in through `ZE_CI_TOKEN`; the legacy
`ZE_SERVER_TOKEN` behavior is unchanged.

The extension point is `ciIdentityProviders` in
`libs/zephyr-agent/src/lib/node-persist/ci-token-identity.ts`.

Each provider adapter:

1. Detects its CI environment from predefined variables.
2. Infers a Git provider actor identity from provider-native job identity data, using provider APIs from the runner when
   needed.
3. Sends `{ provider, issuer, providerSubject, username, emails, email, source }` to `POST /v2/ci-token/exchange` on
   cloud-io.

GitLab reads `CI_JOB_TOKEN` as a JWT when possible and extracts `user_id`, `user_login`, `user_email`, or `email`. If the token is legacy/non-JWT
or has no email claim, it calls the inferred GitLab API v4 `/job` endpoint from the plugin using `CI_JOB_TOKEN`. If the
API is unavailable, it falls back to GitLab's predefined `GITLAB_USER_EMAIL`. When job, project, or pipeline IDs are
available from JWT claims or the `/job` response, they must match `CI_JOB_ID`, `CI_PROJECT_ID`, and `CI_PIPELINE_ID`.

GitHub Actions reads the local webhook payload from `GITHUB_EVENT_PATH`. It prefers the matching commit author email,
then commit committer email, then `head_commit`, then `pusher.email`. It always sends the stable GitHub actor ID from
`GITHUB_ACTOR_ID` when available, keeps it paired with `GITHUB_ACTOR` on reruns, and includes GitHub's noreply email
shape as an email candidate. This requires no
workflow YAML changes beyond setting `ZE_CI_TOKEN`. Reliable multi-email attribution requires the user's GitHub account
to be linked in cloud-io as a `GitProviderIdentity`; email candidates are only a fallback.

Cloud-io does not call GitLab for this flow; provider-specific validation stays in the plugin. The plugin calls
ze-api-gateway's `ci-token-exchange` route, which proxies to cloud-io and does not use worker-auth. Cloud-io validates
the CI token against its separate CI-token table and mints a short-lived Zephyr CI access token.

When `ZE_CI_TOKEN` is present, token exchange failures are terminal. The plugin does not fall back to interactive browser
login in CI. A rejected exchange usually means the workflow actor's Git provider identity is not linked to a Zephyr user.
The error should tell the user to link that Git provider account in Zephyr Cloud and rerun the workflow, while also
checking that the CI token secret belongs to the right Zephyr workspace.

## Access-token caching and concurrency

`ZE_SECRET_TOKEN` and `ZE_CI_TOKEN` have different lifecycles. `ZE_SECRET_TOKEN` is already a bearer credential, so the
agent reads it directly from the environment and never persists it. `ZE_CI_TOKEN` is an exchange credential: the agent
must infer the CI actor and exchange the credential for a short-lived access token before calling Zephyr APIs.

Large monorepo builds run many plugin processes against the same `~/.zephyr` directory. CI access-token resolution uses
an identity-scoped, cross-process single-flight cache so those processes do not all exchange and write the same token:

1. Hash the CI token together with the API gateway and normalized provider identity. The raw CI token is never written to
   disk.
2. Acquire the matching lock under `~/.zephyr/locks` using `proper-lockfile` with retries and stale-lock recovery.
3. Re-read `ze-ci-auth-token:<scope>` from `~/.zephyr/storage` after acquiring the lock.
4. Reuse the access token only when the record has the expected version and scope and its JWT remains valid beyond the
   short-expiry safety window.
5. On a miss, perform the exchange while holding the lock, persist the derived access token with its JWT lifetime as the
   storage TTL, and release the lock. Waiting processes then observe the persisted token instead of exchanging again.

Different API gateways, CI credentials, or actors use different cache keys and locks. Browser/server access tokens
continue to use the `ze-auth-token` record and a separate `auth-token` lock. All credential-bearing storage and lock
targets are owner-only on POSIX systems.

Token coordination is an optimization, not an invariant. Without a lock, processes repeat an exchange or race a
single-key write, which is the behavior that predates the lock. Every token lock therefore runs with
`whenUnavailable: 'proceed'`: an exhausted retry budget or an unusable `~/.zephyr/locks` directory logs under
`ze_log.misc` and continues unlocked instead of failing the build. Callers guarding multi-step state, such as the atomic
partial-asset store, keep the default `whenUnavailable: 'throw'` and pass a shorter retry budget. Both share
`withStorageLock` so there is one implementation of the private lock anchor, stale-lock recovery, and release path.

Authentication cleanup is scoped to authentication records. It must not call `nodePersist.clear()`, because the shared
store also contains application configuration and deployment results produced by concurrent builds. Authenticated
requests declare the credential they used through `HttpRequestOptions.credentialToken`, so a 401 invalidates only that
credential rather than whatever the `Authorization` header happened to contain. CI exchange requests additionally skip
generic 401 cleanup while holding the cache lock to avoid recursively acquiring the same lock; a rejected exchange
removes its scoped cache record before surfacing the terminal CI-token error. Other 401 responses use
compare-and-delete semantics so a delayed response for an older credential cannot remove a newer token written by another
process. A process retains the scoped keys it has used so a later 401 for that newer token can still invalidate it.

A single JWT-expiry implementation lives in `lib/auth/token-expiry.ts` and is shared by the login flow, application
configuration reuse, and the CI access-token cache. `login.ts` re-exports `isTokenStillValid` so credential storage can
use it without importing the interactive login flow, which itself depends on token storage.
