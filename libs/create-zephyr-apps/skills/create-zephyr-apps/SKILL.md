---
name: create-zephyr-apps
description: Scaffold deterministic Zephyr application projects with create-zephyr-apps; use when selecting a template, generating a fresh web or React Native project non-interactively, or verifying the CLI's JSON receipt and structured failures.
---

# Create Zephyr Apps

Use this package only for project bootstrap and its receipt. Hand off bundler
configuration, Module Federation runtime changes, Zephyr deployment, and
post-build diagnostics to the skills that own those concerns.

## Choose the invocation

Pin `create-zephyr-apps` to the exact installed or requested release for
reproducible work. Do not use `latest` for qualification or automation.

When the template is unclear, list the release's supported templates first:

```bash
pnpm dlx create-zephyr-apps@<exact-version> --list-templates --json
```

Use the caller's package runner when pnpm is not the selected package manager.
Keep the package version exact in every case.

## Scaffold without prompts

Choose a fresh, empty output directory and make each side effect explicit:

```bash
pnpm dlx create-zephyr-apps@<exact-version> ./apps/example \
  --template react-rsbuild \
  --package-manager pnpm \
  --no-git \
  --json
```

Apply these rules:

- Pass `--template <id>` instead of relying on an implicit choice.
- Pass `--package-manager pnpm|npm|yarn|bun` when reproducibility matters.
- Pass `--no-git` unless the user explicitly requested repository creation; use
  `--git` only for that request.
- Add `--install` only when dependency installation is requested.
- Add `--build` only when a build is requested. It already implies `--install`.
- Use `--project-type react-native` for a React Native request and keep its
  output in a separate directory from web examples.
- Use `--template-revision <full-40-character-commit>` only when reproducing a
  specifically requested known revision. Otherwise keep the revision pinned by
  the selected CLI release.
- Never write into a non-empty directory or bypass the CLI's refusal to do so.

## Verify the JSON receipt

Treat the process exit code and JSON document as one result. Declare success
only when all of these hold:

- `success` is `true`.
- `directory`, `projectType`, and `template` match the request.
- `templateRevision` is the expected immutable commit.
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
- Treat unknown templates, shortened revision hashes, non-empty destinations,
  fetch mismatches, install failures, and build failures as hard failures.
