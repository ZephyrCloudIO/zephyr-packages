---
summary: Explains how RFCs work in this repository and lists them.
read_when:
  - Proposing a change that spans several packages or defines a contract between surfaces.
  - Looking for the status of an accepted or rejected design.
---

# RFCs

An RFC is a design document for a change that needs agreement before code. Use one when a
decision spans several packages, defines a contract that other tools will depend on, or is
hard to reverse. Small fixes and single-package features do not need one. Use an issue or a
pull request for those.

## Process

1. Copy the front matter from an existing RFC. Pick the next free number, for example
   `0002-short-name.md`, and set `status: draft`.
2. Open a pull request that adds the file. The pull request is the discussion thread. Link
   the related issues in the description and in the `tracking` field.
3. Discuss and revise in the pull request. Record every rejected option under
   _Alternatives considered_. Record every unresolved point under _Open questions_.
4. When the maintainers agree, set `status: accepted` in the same pull request. A
   maintainer merges it. **Merging an RFC with `status: accepted` means it is accepted.**
   An RFC that is not merged is not accepted.
5. Implementation happens in separate pull requests that link the RFC.
6. To change an accepted RFC, open a new pull request that edits it. Say what changed in
   the description. To replace it, add a new RFC and set the old one to `status: superseded`.

## Status

The `status` field in the front matter is the only status. Allowed values:

| Status       | Meaning                                                         |
| ------------ | --------------------------------------------------------------- |
| `draft`      | Under discussion in an open pull request.                       |
| `accepted`   | Merged. Implementations should follow it.                       |
| `rejected`   | Merged for the record, with the reasoning. Do not implement it. |
| `superseded` | Replaced by a later RFC named in `superseded_by`.               |

## Writing an RFC

- Verify every claim about existing behavior against the repository, and cite the file path.
- Mark anything that does not exist yet as a **proposal**.
- Keep the problem, the proposal, the alternatives and the open questions in separate
  sections so reviewers can comment on each.

## Index

| RFC                                | Title            | Status |
| ---------------------------------- | ---------------- | ------ |
| [0001](./0001-outcome-contract.md) | Outcome contract | draft  |
