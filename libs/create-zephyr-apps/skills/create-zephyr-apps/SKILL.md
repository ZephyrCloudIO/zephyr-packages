---
name: create-zephyr-apps
description: Scaffold current Zephyr application projects with create-zephyr-apps; use when selecting a template, generating a fresh web or React Native project non-interactively, or verifying the CLI's JSON receipt and structured failures.
---

# Create Zephyr Apps

Use this package only for project bootstrap and its receipt. Hand off bundler
configuration, Module Federation runtime changes, Zephyr deployment, and
post-build diagnostics to the skills that own those concerns.

## Choose the invocation

Always use the current published release:

When the template is unclear, list the release's supported templates first:

```bash
pnpm dlx create-zephyr-apps@latest --list-templates --json
```

Use the caller's package runner when pnpm is not the selected package manager.
Keep `@latest` in every invocation.

## Scaffold without prompts

Choose a fresh, empty output directory and make each side effect explicit:

```bash
pnpm dlx create-zephyr-apps@latest ./apps/example \
  --template react-rsbuild \
  --package-manager pnpm \
  --no-git \
  --json
```

Apply these rules:

- For web projects, pass `--template <id>` instead of relying on an implicit
  choice.
- Pass `--package-manager pnpm|npm|yarn|bun` when reproducibility matters.
- Pass `--no-git` unless the user explicitly requested repository creation; use
  `--git` only for that request.
- Add `--install` only when dependency installation is requested.
- Add `--build` only when a build is requested. It already implies `--install`.
- For React Native projects, pass `--project-type react-native`, omit
  `--template`, and keep the output in a separate directory from web examples.
- Never write into a non-empty directory or bypass the CLI's refusal to do so.

## Verify the JSON receipt

Treat the process exit code and JSON document as one result. Declare success
only when all of these hold:

- `success` is `true`.
- `directory`, `projectType`, and `template` match the request.
- `templateRevision` is a full 40-character commit.
- `failures` is empty.
- Every recorded command has the expected `stage`, `cwd`, and zero
  `exitCode`.
- `createdFiles` is non-empty and contains the expected project files.
- When a build ran, `artifacts` and `resolvedPackageVersions` contain the
  expected evidence.
- When installation ran, `packageManager.name` matches the explicit selection
  and `packageManager.version` is populated.

Retain the complete JSON receipt as audit evidence; summarize only the outcome
and actionable failure in chat.

## Handle failures

On failure:

- Do not report a partially scaffolded directory as complete.
- Preserve the emitted JSON and identify the failing `stage`, `message`,
  `exitCode`, and concise stderr detail when present.
- Do not silently retry with a different template, revision, package manager, or
  side-effect flag.
- If a retry is authorized, use a new empty directory so the attempt is
  independently reproducible.
- Treat unknown templates, non-empty destinations, fetch mismatches, install
  failures, and build failures as hard failures.
