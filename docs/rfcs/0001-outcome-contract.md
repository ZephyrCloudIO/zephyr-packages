---
summary: Defines one outcome object, exit codes, writing rules and docs rules so plugins, the CLI, CI, MCP and the dashboard report "deployed or not" the same way.
read_when:
  - Changing what a plugin, ze-cli, the MCP server or the dashboard reports after a deploy.
  - Writing or changing a Zephyr error message, an error code page or a CLI JSON result.
  - Implementing the outcome receipt, skip mode or doctor --online work.
rfc: 0001
title: Outcome contract
status: draft
authors:
  - Zack Chapple
created: 2026-10-22
tracking: https://github.com/ZephyrCloudIO/zephyr-packages/issues/688
related:
  - https://github.com/ZephyrCloudIO/zephyr-packages/issues/691
  - https://github.com/ZephyrCloudIO/zephyr-packages/issues/692
  - https://github.com/ZephyrCloudIO/zephyr-packages/issues/693
---

# RFC 0001: Outcome contract

## Summary

When Zephyr cannot be reached, a build can finish green and nothing says the build was not
deployed. This RFC proposes one small, versioned JSON object, the **outcome**. Every surface
reports it with the same field names and the same words: the plugin receipt file, the
`ze-cli` JSON result, the CI step summary, MCP tool results and the dashboard. It also
proposes CLI exit codes that do not collide with `doctor` (contested, see open question 3),
a light set of writing rules with a six-word glossary, and docs requirements for people and
agents.

Everything in this document is a **proposal** unless it cites a file. Statements about
existing behavior were checked against `main` and cite the file. Where I could not verify a
claim in this repository, the text says so.

## Problem

1. **A build that cannot reach Zephyr looks green.** `handleGlobalError` either rethrows
   (only when `ZE_FAIL_BUILD=true`) or logs the error and returns
   (`libs/zephyr-agent/src/lib/errors/handle-global-error.ts:11-17`). Nothing prints a final
   line that says the build was not deployed. The reproduction in #688 shows exit 0, an
   error block and a `dist/` folder.
2. **Pipelines and agents get no stable signal.** A plugin runs inside the bundler. The
   bundler chooses the process exit code, so a plugin cannot signal through it. A pipeline
   that must know whether a build was deployed (regulated, enterprise or agent-driven)
   has to read prose.
3. **Failures with different fixes look the same.** `ERR_HTTP_ERROR` (`ZE40035`) is
   `kind: 'config'` (`libs/zephyr-agent/src/lib/errors/codes.ts:357-368`). It is thrown for
   a refused connection, a DNS failure, a 5xx response and a 4xx response other than 401
   and 403 (`libs/zephyr-agent/src/lib/http/fetch-with-retries.ts:211-250`,
   `libs/zephyr-agent/src/lib/http/http-request.ts:139-147`; 401 and 403 are handled
   before that, at `http-request.ts:102-122`). Its text always says "Please check your
   network connection and try again." The right next step differs for each: wait, get a
   new token, ask for access, or fix a setting.
4. **Each surface would invent its own words.** The CLI, MCP server, plugins and dashboard
   are separate code bases. Without one contract they drift, and an agent has to learn
   several vocabularies.
5. **The CLI has no JSON on failure.** `ze-cli deploy --format json` prints one JSON line
   on success only. A failure goes to stderr and exits 1
   (`libs/zephyr-cli/src/index.ts:36-47,75-77`). `ze-cli run` does not parse `--format` at
   all (`libs/zephyr-cli/src/cli.ts:106-115,161-166` accept it for `doctor` and `deploy`
   only).

### What already exists and is reused

| Existing piece                                                                                                               | Where                                                                             | What this RFC reuses                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doctor` versioned report: `schemaVersion`, stable codes, severity, `remediation`, project-relative evidence, exit codes 0-3 | `libs/zephyr-cli/src/doctor/schema.ts`                                            | Versioning style, stable codes, project-relative paths. Exit codes 1-3 keep their `doctor` meaning when `doctor` runs (see [CLI exit codes](#cli-exit-codes)). |
| `create-zephyr-apps --json`: prompts off, one JSON document, still emitted on failure                                        | `libs/create-zephyr-apps/README.md` ("JSON output")                               | The "one document on stdout, even on failure" pattern.                                                                                                         |
| `ZephyrError` with `code`, `operation`, `reason`                                                                             | `libs/zephyr-agent/src/lib/errors/zephyr-error.ts:71-72,111-120`                  | `reason` is "the stable error code identifying the actionable failure reason".                                                                                 |
| Docs link per error code                                                                                                     | `zephyr-error.ts:45,233` (`https://docs.zephyr-cloud.io/errors/<code lowercase>`) | `docsUrl`.                                                                                                                                                     |
| Redaction helpers `redactString`, `redactUrl`                                                                                | `libs/zephyr-agent/src/lib/security/redaction.ts`                                 | Every value interpolated into a message or URL field passes through them. Fixed template text does not (see Rule 4).                                           |
| `Retry-After` parsing                                                                                                        | `fetch-with-retries.ts:157-170`                                                   | Source of `retryAfterSeconds`. It is not passed into the thrown `ZephyrError` today, so #692 must carry it through.                                            |
| MCP `nextAction` values                                                                                                      | MCP server, **not in this repository**                                            | See [MCP](#mcp).                                                                                                                                               |
| Matching skills PR rule                                                                                                      | `AGENTS.md`                                                                       | Docs requirements below.                                                                                                                                       |

## Design principles

- **Agents and humans are both first-class.** Coding agents run plugins and the CLI more
  often than a person reads the output, and during an outage nobody may be watching.
- **Meaning never depends on prose or color.** The decision fields are `status`, `code`,
  `category`, `retryable` and `nextAction`. The message adds to them and never replaces them.
- **One contract, not one vocabulary per tool.**
- **Do not change defaults.** This RFC does not make failures fail the build. The default
  stays fail-open, and `ZE_FAIL_BUILD=true` stays the way to fail the build.

## Non-goals

- **Retrying the snapshot upload.** Out of scope, as the reviewer decided. It needs server
  support first, so a retry does not do the work twice. The shared retry layer already
  retries `GET`, `HEAD`, `OPTIONS`, `PUT` and `DELETE`, and retries any other method only
  when the caller sets an `Idempotency-Key` header
  (`libs/zephyr-agent/src/lib/http/fetch-with-retries.ts:26,29-36,272`). The reviewer says
  asset uploads are already safe to retry. I did not re-verify that here. `retryable` is
  about the whole step, so this RFC does not depend on either.
- **Failing the build by default.** See [Alternatives](#alternatives-considered).
- **Changing the MCP server or the dashboard.** Those are not in this repository. They are
  follow-ups.
- **A formal controlled language.** See [Alternatives](#alternatives-considered).

## Outcome object, version 1

### Fields

| Field               | Type                                | Meaning                                                                                                                                                   |
| ------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`     | string, `"1.0.0"`                   | Contract version. Changes only on a breaking change.                                                                                                      |
| `status`            | `deployed` \| `skipped` \| `failed` | What happened. `skipped` means the user asked for no deploy. `failed` means a deploy was expected and did not happen.                                     |
| `deployed`          | boolean                             | `true` if and only if `status` is `deployed`. A simple check for scripts.                                                                                 |
| `code`              | string \| null                      | The Zephyr error code, such as `ZE40035`. `null` when there is no error.                                                                                  |
| `category`          | see below                           | The class of failure. `none` unless `status` is `failed`.                                                                                                 |
| `retryable`         | boolean                             | `true` if running the whole Zephyr step again (the deploy), with nothing changed, can succeed. It does not say that a client may replay one HTTP request. |
| `nextAction`        | see below                           | What the caller should do next.                                                                                                                           |
| `retryAfterSeconds` | integer \| null                     | Seconds to wait, only when the server sent `Retry-After`. Never invented.                                                                                 |
| `message`           | string                              | One line for people. Built from a fixed template. Never parse it.                                                                                         |
| `applicationUid`    | string \| null                      | The application, for example `app.project.org`. `null` if the failure came before it was known.                                                           |
| `buildId`           | string \| null                      | The Zephyr build ID. `null` if none was created.                                                                                                          |
| `versionUrl`        | string \| null                      | The immutable URL of the deployed version. `null` unless `status` is `deployed`, or when Zephyr returned none.                                            |
| `durationMs`        | integer                             | Wall-clock time from the start of the Zephyr step to the outcome. It is not the bundler build time.                                                       |
| `docsUrl`           | string \| null                      | The docs page for `code`. `null` when `code` is `null`.                                                                                                   |
| `statusUrl`         | string \| null                      | The Zephyr status page. Non-null only for `unreachable`, `timeout` and `upstream_error`.                                                                  |

Every field is always present. Unknown values are `null`, so a reader never has to test
for a missing key.

### Categories and the decision mapping

| `category`       | When                                                                                                                         | `retryable` | `nextAction`          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------- |
| `none`           | `deployed` and `skipped`                                                                                                     | `false`     | `none`                |
| `unreachable`    | No response: connection refused or reset, DNS failure, no route                                                              | `true`      | `retry_later`         |
| `timeout`        | No answer inside the deadline (30 s by default, `fetch-with-retries.ts:14`), a timed-out socket, or HTTP 408                 | `true`      | `retry_later`         |
| `upstream_error` | Zephyr answered but cannot serve now: HTTP 5xx, 425, 429                                                                     | `true`      | `retry_later`         |
| `auth`           | Token missing, invalid or expired, or HTTP 401, or a CI token exchange failure                                               | `false`     | `refresh_credentials` |
| `forbidden`      | HTTP 403, the account has no access to the target                                                                            | `false`     | `check_permissions`   |
| `config`         | The project's inputs or settings are wrong: missing `package.json` name, no application UID, missing Git data, any other 4xx | `false`     | `correct_request`     |
| `unknown`        | **Proposal.** An error that nothing classifies yet. See [open question 1](#open-questions).                                  | `false`     | `correct_request`     |

The classification of HTTP statuses (408, 425 and 429 above) is a proposal. It matches the
statuses that `fetch-with-retries.ts:27` already treats as retryable (408, 425, 429, and
5xx at line 124). #691 owns the implementation, and it can adjust the table in a follow-up
edit to this RFC.

**Classify on a structured cause, not on text.** Today a refused connection, a timed-out
socket and a user cancellation all become `ERR_HTTP_ERROR` with `status: -1` and differ only
in the prose of `content` (`fetch-with-retries.ts:235-254`). A classifier that reads
`status` alone would call every timeout `unreachable` and every cancellation an outage. So
#691 must carry the Node error code, or an equivalent typed field, on the error and
classify on that. The retry layer already lists the codes
(`fetch-with-retries.ts:16-25`). **Proposal:** `ECONNABORTED` and `ETIMEDOUT` are
`timeout`. `ECONNREFUSED`, `ECONNRESET`, `ENETUNREACH`, `EAI_AGAIN`, `ENOTFOUND` and
`EPIPE` are `unreachable`. The 30 s deadline is enforced as an axios `timeout`
(`fetch-with-retries.ts:323`), which axios reports as `ECONNABORTED` by default, not as
`ETIMEDOUT`. A classifier that lists only `ETIMEDOUT` would call every deadline timeout
`unreachable`, so #691 must confirm the code in a test. A canceled request
(`ERR_CANCELED`) is not an outage. It maps to `unknown`, unless the user aborted the whole
run, in which case no outcome is written.

Today's codes map as follows. These are the starting rows of the classification table that
#691 and #692 maintain next to `codes.ts`:

| Code      | Name                                              | `category`                                      |
| --------- | ------------------------------------------------- | ----------------------------------------------- |
| `ZE10018` | `ERR_AUTH_ERROR` (`codes.ts:128`)                 | `auth`                                          |
| `ZE10037` | `ERR_CI_TOKEN_AUTH` (`codes.ts:433`)              | `auth`                                          |
| `ZE10022` | `ERR_AUTH_FORBIDDEN_ERROR` (`codes.ts:166`)       | `forbidden`                                     |
| `ZE10013` | `ERR_PACKAGE_JSON_MUST_HAVE_NAME` (`codes.ts:67`) | `config`                                        |
| `ZE40035` | `ERR_HTTP_ERROR` (`codes.ts:357`)                 | Depends on the request, see the next paragraph. |

`ZE40035` cannot have one category. For this code the category comes from the HTTP `status`
when there was a response, per the table above (5xx, 425 and 429 are `upstream_error`, 408
is `timeout`, other 4xx is `config`), and from the structured cause when there was none. It
must not come from the code or the `kind`. On the shared paths 401 and 403 do not reach
`ZE40035`: `http-request.ts:102-122` throws `ZE10018` and `ZE10022` first, and
`validateStatus: () => true` (`fetch-with-retries.ts:291`) keeps HTTP responses in-band.
Other codes in the table above are classified by code, as listed. The `category` field of
the outcome is a **new axis**. It is not the existing `ZeErrorCategories` in `codes.ts`,
which is the two-digit code prefix (`10` build, `20` deploy, `30` browser, `40` config). The
names collide, so the docs must say "outcome category" when they mean this field.

### Rules

1. **Meaning never depends on prose or color.** Consumers branch on the decision fields.
   Messages may change wording between releases. The decision fields may not.
2. **Additive only.**
   - New optional fields may be added without a version change. Consumers must ignore
     fields they do not know. The JSON Schema does not set `additionalProperties: false`.
   - A new `category` value is additive for consumers: a consumer that meets a `category` it
     does not know reads `nextAction` and `retryable` only. For writers it is a schema edit
     inside version 1: the `category` enum is extended, and the new value follows the
     `retryable` and `nextAction` invariants below. A strict validator that holds an older
     copy of the schema will reject it, so validators should fetch the current schema once
     it is published (open question 12).
   - A new value of `status` or `nextAction`, a rename, or a change of meaning is
     breaking. It needs `schemaVersion` `2.0.0`.
3. **Consistent invariants.** The schema encodes them, so a writer cannot produce a
   contradiction:
   - `deployed` is `true` if and only if `status` is `deployed`.
   - `status: failed` needs a non-`none` category and a non-null `code`.
   - `nextAction` follows `category` as in the table above.
   - `retryable` is `true` if and only if `nextAction` is `retry_later`. A future retryable
     category therefore needs no change to this rule.
   - `retryAfterSeconds` is `null` unless `retryable` is `true`. It comes from a
     `Retry-After` header, rounded up to whole seconds and capped at 86400.
   - `skipped` has `code: null` and `docsUrl: null`. `failed` has a `docsUrl` of the form
     `https://docs.zephyr-cloud.io/errors/<code in lowercase>`. A contract test checks that
     it matches `code`, because JSON Schema cannot compare two fields.
4. **Bounded and safe.**
   - No tokens, no cookies, no credentials.
   - No absolute paths. A path is project-relative. A user-set `ZEPHYR_RECEIPT_PATH` is an
     input and is never echoed in the outcome.
   - No free-form upstream text. The existing `ERR_HTTP_ERROR` message embeds the response
     body (`{{ content }}`, `codes.ts:357-368`), so an outcome `message` is **never** the
     `ZephyrError` message. It is built from the fixed templates below plus the code and,
     for success, the version URL.
   - `message` is one line, at most 600 characters.
   - **Redaction applies to interpolated values, not to template text.** `redactString`
     matches the word `token` followed by a word (`SENSITIVE_WORD_VALUE`,
     `redaction.ts:13-14`), so it turns the `auth` template into "The token [REDACTED] not
     valid". Template text is fixed and trusted. Only values that come from outside the
     template (an application UID, a URL) are checked. #691 should remove this false
     positive along with the status-code one. A contract test asserts that
     `redactString(line) === line` for the `message` and for the full final line (including
     the status page sentence) of every golden fixture, so a redactor change that mangles
     a template fails in CI. Fixtures use the normalized form of each URL, with a trailing
     slash on a bare origin. `codes.ts:526` already tells users to see
     `https://status.zephyr-cloud.io`. Today the `auth` and `forbidden` templates fail that
     test (checked with the current `redactString`), which is the evidence for the false
     positive.
   - **URL fields hold no userinfo, query or fragment.** `versionUrl`, `docsUrl` and
     `statusUrl` are plain `https://host/path` strings. The schema enforces that. This is a
     stronger guarantee than redaction, which keeps query names and normalizes the URL
     (`redactUrl` adds a trailing slash to a bare origin).
5. **Same words everywhere.** `status`, `category` and `nextAction` values are identical in
   the receipt, the CLI JSON, the CI step summary, MCP results and the dashboard. A surface
   may add fields. It may not rename or translate a value.
6. **A stale outcome must never read as current.** A writer removes the previous receipt
   at the earliest point it runs: when the plugin initializes, and when a `ze-cli` command
   starts. That is before the user's own build, so a build that fails first leaves no old
   `deployed: true` behind. The receipt is then written atomically (a temporary file in the
   same directory, then rename). A missing receipt means "no outcome was recorded".
   Pipelines should treat that as not deployed. This matters on self-hosted runners that
   keep their workspace between runs.
7. **Writing the outcome never fails the build.** If the receipt cannot be written, log one
   warning. With `ZE_FAIL_BUILD=true` the receipt is written before the error is rethrown.

### JSON Schema

This is the proposed normative schema (JSON Schema draft 2020-12). The golden examples
below validate against it. It does not set a `$id`, because the schema has no published
URL yet (see [open question 12](#open-questions)).

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Zephyr outcome",
  "type": "object",
  "required": [
    "schemaVersion",
    "status",
    "deployed",
    "code",
    "category",
    "retryable",
    "nextAction",
    "retryAfterSeconds",
    "message",
    "applicationUid",
    "buildId",
    "versionUrl",
    "durationMs",
    "docsUrl",
    "statusUrl"
  ],
  "properties": {
    "schemaVersion": { "const": "1.0.0" },
    "status": { "enum": ["deployed", "skipped", "failed"] },
    "deployed": { "type": "boolean" },
    "code": {
      "oneOf": [{ "type": "null" }, { "type": "string", "pattern": "^ZE[0-9]{5}$" }]
    },
    "category": {
      "enum": [
        "none",
        "unreachable",
        "timeout",
        "upstream_error",
        "auth",
        "forbidden",
        "config",
        "unknown"
      ]
    },
    "retryable": { "type": "boolean" },
    "nextAction": {
      "enum": ["none", "refresh_credentials", "check_permissions", "retry_later", "correct_request"]
    },
    "retryAfterSeconds": {
      "oneOf": [{ "type": "null" }, { "type": "integer", "minimum": 0, "maximum": 86400 }]
    },
    "message": {
      "type": "string",
      "minLength": 1,
      "maxLength": 600,
      "pattern": "^[^\\u0000-\\u001f\\u2028\\u2029]*$"
    },
    "applicationUid": {
      "oneOf": [{ "type": "null" }, { "type": "string", "pattern": "^\\S{1,256}$" }]
    },
    "buildId": {
      "oneOf": [{ "type": "null" }, { "type": "string", "pattern": "^\\S{1,64}$" }]
    },
    "versionUrl": {
      "oneOf": [
        { "type": "null" },
        { "type": "string", "pattern": "^https://[^\\s?#@]+$", "maxLength": 512 }
      ]
    },
    "durationMs": { "type": "integer", "minimum": 0 },
    "docsUrl": {
      "oneOf": [
        { "type": "null" },
        { "type": "string", "pattern": "^https://[^\\s?#@]+$", "maxLength": 512 }
      ]
    },
    "statusUrl": {
      "oneOf": [
        { "type": "null" },
        { "type": "string", "pattern": "^https://[^\\s?#@]+$", "maxLength": 512 }
      ]
    }
  },
  "allOf": [
    {
      "if": { "properties": { "status": { "const": "deployed" } } },
      "then": {
        "properties": {
          "deployed": { "const": true },
          "code": { "type": "null" },
          "category": { "const": "none" },
          "retryable": { "const": false },
          "nextAction": { "const": "none" },
          "retryAfterSeconds": { "type": "null" },
          "docsUrl": { "type": "null" },
          "statusUrl": { "type": "null" }
        }
      },
      "else": { "properties": { "deployed": { "const": false } } }
    },
    {
      "if": { "properties": { "status": { "const": "skipped" } } },
      "then": {
        "properties": {
          "category": { "const": "none" },
          "retryable": { "const": false },
          "nextAction": { "const": "none" },
          "code": { "type": "null" },
          "retryAfterSeconds": { "type": "null" },
          "versionUrl": { "type": "null" },
          "docsUrl": { "type": "null" },
          "statusUrl": { "type": "null" }
        }
      }
    },
    {
      "if": { "properties": { "status": { "const": "failed" } } },
      "then": {
        "properties": {
          "category": { "not": { "const": "none" } },
          "code": { "type": "string" },
          "versionUrl": { "type": "null" },
          "docsUrl": {
            "type": "string",
            "pattern": "^https://docs\\.zephyr-cloud\\.io/errors/ze[0-9]{5}$"
          }
        }
      }
    },
    {
      "if": { "properties": { "nextAction": { "const": "retry_later" } } },
      "then": { "properties": { "retryable": { "const": true } } },
      "else": {
        "properties": {
          "retryable": { "const": false },
          "retryAfterSeconds": { "type": "null" }
        }
      }
    },
    {
      "if": {
        "properties": { "category": { "enum": ["unreachable", "timeout", "upstream_error"] } }
      },
      "then": { "properties": { "nextAction": { "const": "retry_later" } } },
      "else": { "properties": { "statusUrl": { "type": "null" } } }
    },
    {
      "if": { "properties": { "category": { "const": "auth" } } },
      "then": { "properties": { "nextAction": { "const": "refresh_credentials" } } }
    },
    {
      "if": { "properties": { "category": { "const": "forbidden" } } },
      "then": { "properties": { "nextAction": { "const": "check_permissions" } } }
    },
    {
      "if": { "properties": { "category": { "enum": ["config", "unknown"] } } },
      "then": { "properties": { "nextAction": { "const": "correct_request" } } }
    }
  ]
}
```

### Golden examples

Each example is a complete, valid outcome. Application hosts use reserved example domains. The codes
for the three transient categories are `ZE40035`, because that is the code today's HTTP
failures carry. #691 may add a dedicated code. If it does, the fixtures change with it.

**Deployed**

```json
{
  "schemaVersion": "1.0.0",
  "status": "deployed",
  "deployed": true,
  "code": null,
  "category": "none",
  "retryable": false,
  "nextAction": "none",
  "retryAfterSeconds": null,
  "message": "The build is deployed. The version URL is https://sample-app-17539.example.com/.",
  "applicationUid": "sample-app.sample-project.example-org",
  "buildId": "17539",
  "versionUrl": "https://sample-app-17539.example.com/",
  "durationMs": 4210,
  "docsUrl": null,
  "statusUrl": null
}
```

**Skipped** (the user set `ZE_DISABLED`, a setting proposed in #693)

```json
{
  "schemaVersion": "1.0.0",
  "status": "skipped",
  "deployed": false,
  "code": null,
  "category": "none",
  "retryable": false,
  "nextAction": "none",
  "retryAfterSeconds": null,
  "message": "The build is not deployed. Zephyr is disabled (ZE_DISABLED).",
  "applicationUid": null,
  "buildId": null,
  "versionUrl": null,
  "durationMs": 3,
  "docsUrl": null,
  "statusUrl": null
}
```

**Unreachable** (connection refused)

```json
{
  "schemaVersion": "1.0.0",
  "status": "failed",
  "deployed": false,
  "code": "ZE40035",
  "category": "unreachable",
  "retryable": true,
  "nextAction": "retry_later",
  "retryAfterSeconds": null,
  "message": "The build is not deployed. Zephyr cannot be reached (ZE40035). Try again later.",
  "applicationUid": "sample-app.sample-project.example-org",
  "buildId": null,
  "versionUrl": null,
  "durationMs": 1668,
  "docsUrl": "https://docs.zephyr-cloud.io/errors/ze40035",
  "statusUrl": "https://status.zephyr-cloud.io/"
}
```

**Timeout**

```json
{
  "schemaVersion": "1.0.0",
  "status": "failed",
  "deployed": false,
  "code": "ZE40035",
  "category": "timeout",
  "retryable": true,
  "nextAction": "retry_later",
  "retryAfterSeconds": null,
  "message": "The build is not deployed. Zephyr did not answer in time (ZE40035). Try again later.",
  "applicationUid": "sample-app.sample-project.example-org",
  "buildId": null,
  "versionUrl": null,
  "durationMs": 30412,
  "docsUrl": "https://docs.zephyr-cloud.io/errors/ze40035",
  "statusUrl": "https://status.zephyr-cloud.io/"
}
```

**Upstream error** (HTTP 503 with `Retry-After: 30`)

```json
{
  "schemaVersion": "1.0.0",
  "status": "failed",
  "deployed": false,
  "code": "ZE40035",
  "category": "upstream_error",
  "retryable": true,
  "nextAction": "retry_later",
  "retryAfterSeconds": 30,
  "message": "The build is not deployed. Zephyr reported an error (ZE40035). Try again in 30 seconds.",
  "applicationUid": "sample-app.sample-project.example-org",
  "buildId": null,
  "versionUrl": null,
  "durationMs": 2954,
  "docsUrl": "https://docs.zephyr-cloud.io/errors/ze40035",
  "statusUrl": "https://status.zephyr-cloud.io/"
}
```

**Auth**

```json
{
  "schemaVersion": "1.0.0",
  "status": "failed",
  "deployed": false,
  "code": "ZE10018",
  "category": "auth",
  "retryable": false,
  "nextAction": "refresh_credentials",
  "retryAfterSeconds": null,
  "message": "The build is not deployed. The token is not valid (ZE10018). Get a new token.",
  "applicationUid": "sample-app.sample-project.example-org",
  "buildId": null,
  "versionUrl": null,
  "durationMs": 412,
  "docsUrl": "https://docs.zephyr-cloud.io/errors/ze10018",
  "statusUrl": null
}
```

**Forbidden**

```json
{
  "schemaVersion": "1.0.0",
  "status": "failed",
  "deployed": false,
  "code": "ZE10022",
  "category": "forbidden",
  "retryable": false,
  "nextAction": "check_permissions",
  "retryAfterSeconds": null,
  "message": "The build is not deployed. The token has no access (ZE10022). Ask an organization admin for access.",
  "applicationUid": "sample-app.sample-project.example-org",
  "buildId": null,
  "versionUrl": null,
  "durationMs": 530,
  "docsUrl": "https://docs.zephyr-cloud.io/errors/ze10022",
  "statusUrl": null
}
```

**Config**

```json
{
  "schemaVersion": "1.0.0",
  "status": "failed",
  "deployed": false,
  "code": "ZE10013",
  "category": "config",
  "retryable": false,
  "nextAction": "correct_request",
  "retryAfterSeconds": null,
  "message": "The build is not deployed. The configuration is not correct (ZE10013). Correct the setting. Run the command again.",
  "applicationUid": null,
  "buildId": null,
  "versionUrl": null,
  "durationMs": 21,
  "docsUrl": "https://docs.zephyr-cloud.io/errors/ze10013",
  "statusUrl": null
}
```

### Choosing `code`

`code` is the code of the **actionable cause**. In `ZephyrError` that is `reason`
(`zephyr-error.ts:71-72,116-120`), which is the code of the innermost `ZephyrError` cause
unless a caller sets it. It is not the outer `code`. #688 shows `ZE20014` (load application
configuration) wrapping `ZE40035` (HTTP error). The outcome would carry `ZE40035`, the
cause that decides the next step. See [open question 2](#open-questions).

### Existing `deploy --format json` result

Today `ze-cli deploy --format json` prints `{ applicationUid, versionUrl, targetUrls }`
(`libs/zephyr-cli/src/commands/deploy.ts:19-26`, `index.ts:47`). The outcome keeps
`applicationUid` and `versionUrl` with the same meaning. **Proposal:** add an optional
`targetUrls` array, only on `deployed`, so current readers keep working. See
[open question 7](#open-questions).

## Mapping to existing pieces

### MCP

The MCP server is **not in this repository**, and I could not verify its behavior from
code. The values below come from #688. The public MCP docs page
(`docs.zephyr-cloud.io/tools/api-mcp.md`) describes a different tool surface (`search` and
`execute`) and does not mention them. The hosted site-publishing connector's server
instructions mention `refresh_credentials`, `check_permissions`, `retry_later` and
`Retry-After`. Its tool descriptions mention `requestId` retry protection and
`expectedVersionId`. That is partial corroboration, not verification.

| MCP (per #688)                                                                                     | Outcome                                                                                                                            |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `nextAction`: `none`, `refresh_credentials`, `check_permissions`, `retry_later`, `correct_request` | `nextAction`, same values and same meaning. The outcome adds nothing to this set.                                                  |
| `recovery`                                                                                         | Not an outcome field. Human guidance lives in `message` and on the `docsUrl` page.                                                 |
| `retryAfter`                                                                                       | `retryAfterSeconds`. The unit of `retryAfter` is unverified (see [open question 9](#open-questions)).                              |
| `structuredContent` and `outputSchema`                                                             | An MCP result for a deploy-like operation returns the outcome as `structuredContent`, and `outputSchema` is the JSON Schema above. |

The outcome adds `category`, `retryable` and `status`, which MCP tool errors may not carry
today. Adding them to MCP is a follow-up outside this repository.

### `doctor`

`doctor` and the outcome describe different subjects. `doctor` analyzes a project.
The outcome reports one deploy attempt. They are separate documents that share style and
vocabulary.

| `doctor` (`libs/zephyr-cli/src/doctor/schema.ts`) | Outcome                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `schemaVersion: '1.0.0'`                          | Same style, a string constant. The two versions are independent.        |
| `findings[].code` (`ZD0001` to `ZD0601`)          | `code` uses the runtime `ZE#####` space. `ZD` codes stay `doctor`-only. |
| `findings[].severity`, `remediation`              | `status` and `nextAction`. A doctor finding is not an outcome.          |
| `findings[].evidence[].path` is project-relative  | The same rule for every path.                                           |
| `exitCode` and `status` in the report             | The outcome has no `exitCode`. A plugin receipt cannot have one.        |

**Proposal for #693:** each `doctor --online` finding may carry the optional, additive
fields `category` and `nextAction`, with the same values, so "Zephyr cannot be reached" has
the same words in `doctor` and in a receipt.

**A gap to know about.** `doctor` says paths are project-relative, but
`DoctorReport.projectDirectory` is an absolute path (`analyze.ts:90-91`). It is printed in
the text output (`format.ts:13`) and is part of the JSON report (`format.ts:7`). The
outcome must not copy that. Fixing `doctor` is out of scope here.

### Error codes and docs pages

Codes follow `ZE` + two digits of prefix + three digits of ID (`codes.ts` header). The
docs page for a code is `https://docs.zephyr-cloud.io/errors/<code in lowercase>`
(`zephyr-error.ts:45,233`), and `docsUrl` uses the same rule. The docs site lists pages for
many codes, including `ZE20014` and `ZE40035`. The one page I opened, `ZE20014`, is a list
of recovery steps. It does not have the four headings this RFC requires. I did not check
the other pages, so assume they need a pass. See [Docs requirements](#docs-requirements).

### Existing logging

`writeRunSummary` (`libs/zephyr-agent/src/lib/logging/file-logger.ts:181-203`) is exported
(`libs/zephyr-agent/src/index.ts:64`) and never called in this repository. It does not fit
as the receipt writer:

- It writes `summary.json` into the per-run log directory, under `~/.zephyr/logs/` unless
  `ZEPHYR_LOG_PATH` overrides it (`file-logger.ts:34-36`). That directory exists only when
  file logging has created a run (`initializeLogRun`, line 42, called from
  `writeLogToFile`, line 119).
- Its fields (`success`, `duration`, `errorCount`, `warnCount`, `buildId`,
  `applicationUid`, and the written `startTime` and `endTime`) are not the outcome. There
  is no `code`, `category` or `nextAction`.
- It uses `appendFileSync` (line 201), so a second call would append a second JSON
  document to the same file.

**Proposal:** write the receipt with a new small writer and leave `writeRunSummary`
alone. This **changes a scope item of #692**, which says to reuse `writeRunSummary`. If
the RFC is accepted, the body of #692 should be updated. See
[open question 13](#open-questions).

## Surfaces

### 1. Receipt file (plugins and CLI)

- Default path: `.zephyr/last-deploy.json`, relative to the project root.
  `ZEPHYR_RECEIPT_PATH` overrides it. A relative override resolves against the project
  root. The **project root** is the `context` directory that the code passes to
  `ZephyrEngine.create`: the bundler's project context for a plugin, and the working
  directory for `ze-cli` (see `libs/zephyr-cli/src/commands/deploy.ts`). In a monorepo
  that is the package being built, not the repository root.
- Written on success **and** failure, and on `skipped`. Written before `ZE_FAIL_BUILD=true`
  rethrows.
- `handleGlobalError` is the shared place where plugins decide between logging and
  rethrowing, with callers in `libs/vite-plugin-zephyr`, `libs/zephyr-webpack-plugin`,
  `libs/rollup-plugin-zephyr` and others. It is **not** the only exit: for example
  `libs/zephyr-webpack-plugin/src/webpack-plugin/with-zephyr.ts:90,147` rethrow directly,
  and #688 lists the array-config, coordinated-build and missing-Git paths. **Proposal:**
  one shared receipt writer, called from `handleGlobalError` and from every path that
  throws directly. The `ZE_FAIL_BUILD` work in #691 routes those paths through one
  function, and #692 attaches the writer to it. Success is written where the build is
  finished.
- UTF-8, one JSON object, a trailing newline.
- The project-level `.zephyr/` directory is different from the user-level `~/.zephyr/`
  that `ZE_PATH` points to (`libs/zephyr-agent/src/lib/node-persist/storage-keys.ts:7`).
  Projects should add `.zephyr/` to `.gitignore`. See [open question 11](#open-questions).

A pipeline reads the receipt, not the logs:

```sh
# Fails the step unless the build was deployed. A missing file also fails.
jq -e '.deployed == true' .zephyr/last-deploy.json
```

### 2. CLI `--format json`

- With `--format json`, stdout carries **exactly one** JSON document, even on failure. The
  document is an outcome, or, for an exit `1` failure that is not an outcome, the minimal
  error document from #691 (`code`, `message`). All other output goes to stderr. The CLI
  already has the mechanism: `reserveStdout` (`libs/zephyr-cli/src/lib/stdout.ts`) sends
  other stdout writes to stderr.
- The document is the outcome. It is also written to the receipt.
- Today only `doctor` and `deploy` accept `--format`. **Proposal:** `run` accepts it too.
  `watch` is an open question, because it is long-running ([open question 5](#open-questions)).
- Never prompt without a TTY, when `CI` is set, or with `--format json`. The CLI already
  fails fast in CI instead of prompting (reviewer comment on #688). A missing input is
  `category: config`, `nextAction: correct_request`.
- Failures before a Zephyr step starts (a usage error, or the user's own build command
  failing) are not Zephyr outcomes. `ze-cli run` throws a build-command failure as
  `ERR_UNKNOWN` (`run.ts:121-131`), which the classification would call `unknown`. It is
  special-cased: exit `1`, and in JSON mode the minimal error document instead of an outcome.
  The CLI decides this by **phase**, not by code: did the Zephyr step start? Usage errors
  (`index.ts:31,61`), build-command failures (`run.ts:122,129`) and unclassified HTTP
  failures (`fetch-with-retries.ts:257,353`) all throw the same `ERR_UNKNOWN`. See
  [open question 8](#open-questions).
- When `run` cannot detect the output directory (`run.ts:147-152`) there is no `ZE` code
  yet, and `failed` needs one. **Proposal:** #691 adds a code for it, with category
  `config` and `nextAction: correct_request`, because the fix is to run `ze-cli deploy
  <dir>` or set the output directory. #691 also treats the "code, kind, message" error
  document as temporary: it must not emit `kind`, which is the existing code-prefix axis
  (see [Categories](#categories-and-the-decision-mapping)). Use `category`. The body of #691
  says "code, kind, message" and needs that update, as #692 needs one for
  `writeRunSummary` ([open question 13](#open-questions)).

### 3. CI step summary and annotation

- When `GITHUB_ACTIONS` is set, append a short Markdown block to the file named by
  `GITHUB_STEP_SUMMARY`. Append, never overwrite: other steps share the file.
- The block holds the final line (see section 4), the code, the docs link and, for
  retryable failures, `retryAfterSeconds`. It uses words, not symbols. No check marks,
  crosses or emoji.
- On `failed`, print `::error title=Zephyr::<message>`. On `skipped`, print
  `::notice title=Zephyr::<message>`. Escape `%`, carriage return and line feed as
  `%25`, `%0D` and `%0A`, as the workflow command syntax requires.
- With `--format json` stdout is reserved for the JSON document, so the annotation goes to
  stderr. I did not verify that the Actions runner reads workflow commands from stderr.
  #692 must test it. If it does not, the annotation is skipped in JSON mode.
- An annotation does **not** change the step result. Only the process exit code does.
  The summary and annotation make a green step visible. They do not make it red.
- Other CI systems are out of scope for version 1. The receipt is the portable signal.

### 4. The final line

Every Zephyr step ends with one human line that states the outcome and the next step. The
final line is the `message` field. For `unreachable`, `timeout` and `upstream_error` it is
followed by one more sentence that names the status page: "The status page is
`<statusUrl>`." The step summary uses the same text. The line is printed with no color, no
emoji and no assumption about terminal width. In a plugin the bundler can print after this
line, so the line is a courtesy. The receipt is the signal.

The templates do not say "The build is finished" or "The bundle is built", which #692 and
#693 use in their examples. A plugin step can run before the bundler finishes, and
`ze-cli deploy` does not build at all, so the line says only what Zephyr knows: whether
anything is deployed. This is a deliberate departure from the issue text.

Color is already unreliable in this repository. `picocolor.ts:22-24` turns color on when
`FORCE_COLOR` is set while `NO_COLOR` is not and debug is off, **or** when stdout is a TTY,
`CI` is unset and `TERM` is not `dumb`. A TTY without `CI` still gets color when `NO_COLOR`
is set. The final line therefore uses no color at all, and #692 should make `NO_COLOR` win.

## CLI exit codes

### What exists

- `doctor` returns `0` healthy, `1` findings, `2` invalid project, `3` tool failure
  (`libs/zephyr-cli/src/doctor/schema.ts`, `DoctorExitCode`). They are part of its
  report and documented. They stay as they are.
- `run`, `deploy` and `watch` exit `1` on any thrown error (`index.ts:75-77,82-84`).
  `ze-cli run` also exits `0` when it cannot detect the output directory and skips the
  upload (`libs/zephyr-cli/src/commands/run.ts:147-152`).

### Plugins cannot set exit codes

A plugin runs inside the bundler, and the bundler decides the exit code. The only lever
a plugin has is to throw (`ZE_FAIL_BUILD=true`), which makes the bundler fail with its own
non-zero code. A plugin cannot choose a code, and it cannot say "skipped" or "unreachable"
through one. **The receipt is the plugin's signal.** The mapping below is for `ze-cli`
only.

### Proposal

`ze-cli run`, `deploy` and `watch` map the outcome to the exit code. One table covers the
whole `ze-cli` binary, so there is one documented scheme with owned ranges. `doctor` owns
2 and 3. Exit 1 is the generic failure code of every command, and what it means depends on
the command. The outcome commands never emit 2 or 3, and `doctor` never emits 10 or above.

| Exit | Used by                  | Meaning                                                                                                                                                                  |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0`  | all commands             | Success. `doctor`: healthy. `run`, `deploy`, `watch`: `deployed`, or `skipped` because the user set `ZE_DISABLED`.                                                       |
| `1`  | `doctor`                 | Findings (unchanged).                                                                                                                                                    |
| `1`  | `run`, `deploy`, `watch` | A failure that is not a Zephyr outcome: a usage error, the user's build command failing, a crash. No outcome document. With `--format json`: the minimal error document. |
| `2`  | `doctor` only            | Invalid project (unchanged).                                                                                                                                             |
| `3`  | `doctor` only            | Tool failure (unchanged).                                                                                                                                                |
| `10` | none                     | Reserved. Not used in version 1. See [open question 3](#open-questions).                                                                                                 |
| `20` | `run`, `deploy`, `watch` | Failed, a later retry can work. `nextAction: retry_later`.                                                                                                               |
| `30` | `run`, `deploy`, `watch` | Failed, credentials or access must change. `nextAction: refresh_credentials` or `check_permissions`.                                                                     |
| `40` | `run`, `deploy`, `watch` | Failed, a setting or input must change. `nextAction: correct_request`. Also used for `unknown`: inspect the error code page, and report it if it is unexplained.         |

**This is the part of the RFC most likely to be contested.** The reviewer comment on #688
says "`doctor` already uses 0-3, so let's not add a second set to the same CLI." This
proposal adds three numbers (20, 30, 40) to the same binary. It keeps them out of 1-3, and
it puts them in the same table as `doctor`'s codes, but it is still new numbers. The
alternative that follows the comment most strictly is **Option B**: outcome commands exit
`0` (deployed or skipped) or `1` (anything else), and the JSON and the receipt carry every
distinction. See [Alternatives](#alternatives-considered) and
[open question 3](#open-questions). The maintainers should choose before #692 builds it.

Reasons for the table:

- **Exit `1` is reused, and it already means different things.** For `doctor` it means
  "findings". For `run`, `deploy` and `watch` today it means "any failure"
  (`index.ts:75-77`). The proposal narrows the second meaning to "a failure that is not a
  Zephyr outcome". `doctor` is a separate command, and its codes do not change.
- **Grouped by `nextAction`**, because that is the decision. `30` merges `auth` and
  `forbidden`. A caller that must tell them apart reads the JSON.
- **A CI script with no JSON parser can still branch**, for example "retry the step only on
  `20`". That is the benefit over Option B.
- **Exit code 0 for `skipped`** follows #693, whose acceptance says skip mode exits 0.
  Exit 0 means "the command did what the user asked". The receipt and the JSON say
  `deployed: false`. A pipeline that must deploy checks `deployed`.
- **No codes above 100.** Shells use 126, 127 and 128+N.
- The outcome exit codes are separate from `ZE_FAIL_BUILD`. Only `handleGlobalError`
  reads it today, and the CLI does not call that function. **Proposal:** the CLI keeps
  ignoring `ZE_FAIL_BUILD`, because the CLI already exits non-zero on failure.

`ze-cli run`, `deploy` and `watch` on a failed Zephyr step today exit 1. After this change
a Zephyr failure exits `20`, `30` or `40`. That is a behavior change for scripts that test
`== 1`, and the release notes for #692 must call it out. The `run` output-directory skip
changes twice: from `0` to a plain non-zero exit in #691 (the issue asks for "a plain
non-zero exit"), then to `40` in #692.

## Writing rules

Short messages that say what failed, the code and what to do. These are guidelines for
authors and reviewers. They are not a formal controlled language (see
[Alternatives](#alternatives-considered)).

1. **Say what failed, give the code, say what to do.** In that order. Name the thing:
   "Zephyr cannot be reached (ZE40035)", not "something went wrong".
2. **Short sentences.** One idea per sentence. About 20 words at most. Active voice and
   simple tenses (present or past). Keep articles. Avoid idioms and contractions.
3. **Use the glossary and nothing else for these things:**

   | Term        | Means                                                              |
   | ----------- | ------------------------------------------------------------------ |
   | build       | Making the files of an application, and the result of making them. |
   | deploy      | Send a build to Zephyr and make it available at its version URL.   |
   | release     | Point an environment at a version.                                 |
   | version     | One immutable deployed build, with its version URL.                |
   | environment | A named target that serves one version.                            |
   | token       | A credential that proves who is calling.                           |

   Do not switch between "deploy", "ship", "push" and "publish" for the same action. The
   MCP tool names `publish_site_content` and `promote_build` are fixed API names. The docs
   should state that `promote_build` means **release**.

4. **Do not rely on color, emoji or symbols** for meaning. A message makes sense in a
   log file and in a screen reader.
5. **No secrets, no absolute paths, no upstream text** in a message (see the outcome
   rules).
6. **Each message links to its docs page** through the code.

The glossary is kept in the repository next to the message templates. The six terms are
the owner's list. The examples in #692 and #693 say "The bundle is built", and "bundle" is
not in the glossary. The templates below say "build" and do not claim that a build ran
(see [section 4](#4-the-final-line)). See [open question 10](#open-questions).

### Message templates

`<code>` is the outcome `code`. Each template is the `message` for its category.

| Case                 | Template                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `deployed`           | The build is deployed. The version URL is `<versionUrl>`.                                                                                |
| `skipped`            | The build is not deployed. Zephyr is disabled (`ZE_DISABLED`).                                                                           |
| `unreachable`        | The build is not deployed. Zephyr cannot be reached (`<code>`). Try again later.                                                         |
| `timeout`            | The build is not deployed. Zephyr did not answer in time (`<code>`). Try again later.                                                    |
| `upstream_error`     | The build is not deployed. Zephyr reported an error (`<code>`). Try again later. With `retryAfterSeconds`: "Try again in `<n>` seconds." |
| `auth`               | The build is not deployed. The token is not valid (`<code>`). Get a new token.                                                           |
| `forbidden`          | The build is not deployed. The token has no access (`<code>`). Ask an organization admin for access.                                     |
| `config`             | The build is not deployed. The configuration is not correct (`<code>`). Correct the setting. Run the command again.                      |
| `unknown` (proposal) | The build is not deployed. Zephyr stopped with an error (`<code>`). Open the docs page for this code.                                    |

For `unreachable`, `timeout` and `upstream_error`, the final line printed to the log adds
the status page sentence described in [section 4](#4-the-final-line). That sentence is not
part of the `message` field.

A small automated test over the templates enforces the mechanical rules: the code is present
in every failure template, no emoji, no contractions, no sentence above 25 words, and none
of the banned words `ship`, `push`, `publish`, `promote` and `bundle` (the glossary words
replace them). The test checks form. A person reviews wording.

## Docs requirements

The docs site is not in this repository. It has an index in `llms.txt` style
(`docs.zephyr-cloud.io/llms.txt`), an error encyclopedia (`/errors.md`) and a CI/CD
automation page (`/features/automation.md`) that already documents `ZE_FAIL_BUILD`.

1. **A page for every code**, with four headings: _What happened_, _What to do_,
   _Why it matters_, _For automation_. _For automation_ names the field to read (`category`
   and `nextAction`), says whether to retry, and says what not to retry.
2. **A receipt schema page** with the JSON Schema and the golden examples.
3. **A short "Build pipelines and agents" page** covering `ZE_FAIL_BUILD`, skip mode, the
   receipt, the exit codes and the `jq` example above.
4. **Plain, fetchable Markdown** for these pages, linked from `llms.txt` and included in
   `llms-full.txt`.
5. **The existing `ZE20014` page** and the other code pages move to the four-heading
   format when their code is touched by #691 or #692.
6. **A matching pull request in `ZephyrCloudIO/skills`**, as `AGENTS.md` requires. It
   updates the `zephyr-core` skill and the integration guides under
   `skills/zephyr-core/references/integrations/`: read the receipt or JSON result, not the
   logs; branch on `nextAction`; never retry `config`, `auth` or `forbidden` without
   changing something; on `retry_later` back off and honor `retryAfterSeconds`.
7. **Contract tests.** Golden fixtures per category validated against the schema. Output
   checked with `NO_COLOR=1` and piped to a file. An agent walkthrough test: given only a
   fixture and the skill text, the correct next action is chosen for each category.

## Future: safety for mutating MCP operations

**This section is not part of version 1. It is a direction, not a decision.**

Reads and deploys are not the risky part. Operations that change what users are served,
such as releasing a version to an environment, need extra care when an unattended agent
calls them. Proposed rules for a later RFC:

- **Dry run.** A `dryRun` input returns the structured before and after and changes
  nothing.
- **Idempotency key.** A caller-supplied `requestId` makes a retry safe. The same key with
  the same input returns the first result. The same key with different input is an error
  with `nextAction: correct_request`. The connector's `publish_site_content` already takes
  a `requestId` (from its tool description, not from this repository).
- **Explicit confirm.** An operation that changes what users are served requires
  `confirm: true`. Without it, the tool returns the dry-run result and does nothing.
- **Precondition.** An observed-state check such as `expectedVersionId`, which the
  connector's `promote_build` already takes. The tool descriptions say Zephyr offers no
  atomic compare-and-swap, so this is a guard, not a lock.
- **Tool annotations** from the MCP specification: `readOnlyHint` for reads, and
  `destructiveHint` and `idempotentHint` for mutations. Set them truthfully.
- **Results are outcomes.** A mutation returns the outcome object as `structuredContent`.

## Alternatives considered

1. **Require ASD-STE100 for every message.** This was the first proposal in #688. It is
   dropped, as the reviewer decided. It is a controlled-language specification with an
   approved-word dictionary and fixed grammar rules. Conformance needs trained reviewers,
   and a script can check only some of its rules. That cost is too high for a developer
   tool. Short messages, a glossary and a mechanical check give most of the benefit.
2. **Option B: no new exit codes.** Outcome commands exit `0` (deployed or skipped) or `1`
   (anything else), and the JSON and the receipt carry every distinction. This is the
   strictest reading of the reviewer comment, and it is the fallback if the maintainers
   reject 20, 30 and 40. Benefit: no new numbers to document or keep stable. Cost: a CI
   script with no JSON parser cannot tell "retry later" from "fix a setting". See
   [open question 3](#open-questions).
3. **#688's example numbers (0 deployed, 10 skipped, 20, 30, 40).** Kept for 20, 30 and 40.
   Skipped is `0` instead of `10`, because #693's acceptance says skip mode exits 0.
4. **Exit code only, no receipt.** Fails for plugins. The bundler owns the exit code.
5. **Make failures fail the build by default.** Fixes the green-build problem for
   everyone, but it changes behavior for every user during every outage. `ZE_FAIL_BUILD=true`
   already exists for teams that want it. Out of scope.
6. **Reuse the `doctor` report shape.** It describes project analysis, has fields that do
   not apply, and carries an absolute `projectDirectory`. Sharing style, not the shape,
   is cleaner.
7. **HTTP problem details (RFC 9457).** It has `type`, `title`, `status`, `detail` and
   extension members. Its `status` is an HTTP status, which collides in meaning with our
   `status`. It has nothing for `retryable` or `nextAction`. A thin mapping is possible
   later (`type` could be `docsUrl`), but it is not the base format.
8. **Extend `writeRunSummary` into the receipt.** See [Existing logging](#existing-logging).
9. **Per-surface vocabularies.** The status quo. An agent would have to learn several.
10. **Parse the log text.** Not stable, not safe, and not usable by agents.

## Open questions

Each has a recommendation. Reviewers: please push back on any of them.

1. **Is `unknown` a category?** Some failures are not classified (`ERR_UNKNOWN`, `ZE00000`),
   and the receipt must still be written. Without `unknown`, the schema cannot describe
   them. _Recommendation:_ include `unknown` in version 1 with `nextAction: correct_request`
   and `retryable: false`, so an agent does not loop. This adds a value to the list in #688.
2. **Outer code or `reason` as `code`?** _Recommendation:_ `reason`, the actionable cause.
   The outer code is still in the error log. The cost is that `ZE40035` appears in many
   receipts until #691 adds dedicated codes.
3. **Which exit-code scheme?** The reviewer comment on #688 says not to add a second set of
   codes next to `doctor`'s 0-3. The draft adds 20, 30 and 40 for `ze-cli run`, `deploy`
   and `watch`, in one table with `doctor`'s codes. Option B (exit `0` or `1` only) is the
   strict alternative. _Recommendation:_ 20, 30 and 40, because they let a script retry
   only when retrying can help. This is the maintainers' call. Related: should `skipped`
   ever be non-zero? _Recommendation:_ exit `0` (matches #693). Exit `10` is reserved in
   case a "strict" option is wanted later, for example a `--require-deploy` flag. It is not
   designed here.
4. **Several applications in one project root.** Array configs and multi-compiler builds
   may write more than one outcome to one path, and the last writer wins.
   _Recommendation:_ start with one file and document it. Consider a `{applicationUid}`
   placeholder in `ZEPHYR_RECEIPT_PATH` later.
5. **`watch --format json`.** `watch` runs until stopped, so "exactly one document" cannot
   hold. _Recommendation:_ one outcome per publication, one per line (NDJSON), and the
   receipt holds the latest.
6. **Add `generatedAt`?** A timestamp helps humans spot a stale file. The "remove, then
   write" rule already covers the main risk. _Recommendation:_ leave it out of version 1.
   It can be added later because additions are free.
7. **`targetUrls` on `deploy`.** _Recommendation:_ add it as an optional field, so
   current `deploy --format json` readers do not break. It is not in #688's list.
8. **The user's own build command fails** (`ze-cli run`). There is no Zephyr outcome.
   _Recommendation:_ keep exit `1` and write no receipt in version 1. A later version
   could add a category for it.
9. **MCP details I could not verify.** The unit of `retryAfter`, the exact set of
   `nextAction` values and whether `recovery` is a string. Please confirm against the MCP
   server source.
10. **Glossary and "bundle".** The six terms are the owner's list. "Bundle" is used in
    #692 and #693. _Recommendation:_ use "build" in templates, as above.
11. **`.gitignore` for `.zephyr/`.** The receipt should not be committed.
    _Recommendation:_ document it and add it to `create-zephyr-apps` templates. Do not
    write to `.gitignore` automatically.
12. **Where the schema lives.** _Recommendation:_ the types, the JSON Schema and the golden
    fixtures live in `libs/zephyr-edge-contract`, which both `zephyr-agent` and
    `zephyr-cli` already import. Publish the schema file on the docs site. Choose its URL
    when the docs page exists, then add `$id`.
13. **`writeRunSummary` and the #692 scope.** #692 says to reuse `writeRunSummary`. This
    RFC says to leave it alone (see [Existing logging](#existing-logging)).
    _Recommendation:_ update #692 when the RFC is accepted. Separately, decide whether to
    delete the unused function or keep it for a later run-summary feature.

## Rollout plan

Order: #691 and the skip mode of #693 can start now. They do not need this RFC to be
accepted, as their issues say. Only the parts that use the outcome object wait for it: all
of #692, the `status: skipped` receipt in #693, and the `category` and `nextAction` fields
on `doctor --online` findings. Each step opens its matching `ZephyrCloudIO/skills` pull
request.

| Step | Issue                                | Delivers                                                                                                                                                                                                                                                                                                                                    | Depends on the RFC for                                                                                                                                                                        |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | This RFC                             | Schema, glossary, templates, exit-code table. `status: accepted` on merge.                                                                                                                                                                                                                                                                  |                                                                                                                                                                                               |
| 1    | #691 quick fixes                     | Redaction fix, including the `token` false positive. Classification of unreachable, timeout and upstream failures, on a structured cause. A new code for the `run` output-directory skip. `/resolve` timeout. `ZE_FAIL_BUILD` on every path, through one function. A minimal CLI error document. Non-zero exit when `run` skips the upload. | Starts now. It should use the category names and the structured-cause rule in this RFC, so no rename follows. The minimal error document uses `code` and `message`, and does not emit `kind`. |
| 2    | #692 outcome receipt                 | The schema and types in `zephyr-edge-contract`. Golden fixtures. The receipt writer (removes the old receipt at start), the final line, the step summary and annotation. `Retry-After` carried into the error. `--format json` on `run`, `deploy` and `watch`. Exit codes, per the decision in open question 3. Docs pages. Skills PR.      | Everything in this RFC.                                                                                                                                                                       |
| 3    | #693 skip mode and `doctor --online` | Skip mode starts now. `ZE_DISABLED` writes `status: skipped` once #692 lands. `doctor --online` findings carry `category` and `nextAction`. `doctor` exit codes stay 0-3.                                                                                                                                                                   | The `skipped` semantics and the `doctor` mapping.                                                                                                                                             |
| 4    | Follow-ups outside this repository   | MCP results and the dashboard adopt the outcome. The mutation-safety RFC.                                                                                                                                                                                                                                                                   |                                                                                                                                                                                               |

The redaction fix in #691 matters to the receipt. The redactor treats "status code 503"
as a secret (`SENSITIVE_WORD_VALUE`, `redaction.ts:13-14`), as the reviewer noted. The same
pattern turns "The token is not valid" into "The token [REDACTED] not valid". Until both
are fixed, a message that carries a status loses it, and the `auth` and `forbidden`
templates cannot pass the redaction test in Rule 4.

### Compatibility

- Default behavior stays fail-open. Nothing fails that did not fail before, except
  `ze-cli run` skipping an upload (#691) and the new CLI exit codes (#692).
- New files appear only at `.zephyr/last-deploy.json` or `ZEPHYR_RECEIPT_PATH`.
- Every addition to the outcome is additive after version 1. Consumers must ignore
  unknown fields.
