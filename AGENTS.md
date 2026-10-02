# Intent tooling

Use `pnpm skills:intent` for Intent commands in this workspace. Replace the
managed block's `pnpm exec intent` invocations with that wrapper. Intent 0.5
requires the classic TypeScript compiler API; the wrapper supplies the pinned
development-only compatibility compiler without changing native TypeScript 7
used by the SDK packages. CI runs the same wrapper.

## Clearing the Check Skills gate

`Check Skills` fails when a pull request changes a file listed in a skill's
`sources:` or the planning records without a recorded review. To clear it:

1. Run `pnpm skills:review --json` to list the pending items and their changed
   files.
2. Update any skill whose guidance the change affects, then rerun
   `pnpm skills:sync`.
3. Record each outcome with evidence: annotate the JSON report and pass it to
   `pnpm skills:review --record <report.json>`, or use
   `pnpm skills:review --unchanged "<reason>"` when no guidance is affected.
4. Commit `.intent/review-state.json` and confirm `pnpm skills:check` passes.

`.intent/review-state.json` stores per-file hashes, so parallel pull requests
can conflict on it. Resolve a conflict by taking the base branch's copy,
rerunning the review steps on the rebased branch, and recording again; do not
hand-merge hashes.

<!-- intent-maintainer:start -->

## Library Skill Maintenance

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before substantial library source, documentation, examples, tests, or skill work, run `pnpm exec intent meta generate-skill` and follow the packaged maintainer procedure.
Use the current request and repository evidence. For initial skills, propose a useful batch and reuse any scope already agreed with the maintainer.
Before handing off a skill batch or library change, run `pnpm exec intent maintainer review --json`. Follow the maintainer procedure to update affected guidance, run task checks, and record completed review outcomes. Report an evidence-backed no-op or missing evidence explicitly.
Create and incrementally maintain domain_map.yaml, skill_spec.md, and skill_tree.yaml in the established artifact location for every skill batch. Preserve prior tasks, maintainer decisions, and remaining work.
Keep maintainer decisions and changes in the repository; do not require the user to repeat the procedure in later sessions.
Use intent maintainer setup to initialize missing records, maintainer add to register skills, maintainer status to identify work, and maintainer sync to update generated metadata. Finish with intent maintainer check.
<!-- intent-maintainer:end -->
