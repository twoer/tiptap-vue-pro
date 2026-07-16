# Handoff

Status: active

Use this file when starting or ending a larger slice.

## Current Branch Note

As of the latest local work on `codex/slash-command-v2`, two feature slices are
committed:

- Find/Replace panel positioning and spacing polish.
- Image crop before upload across core, three adapters, playground, docs, and
  browser smoke coverage.

## Startup Checklist

1. Check branch and worktree:

   ```bash
   git status --short --branch
   ```

2. Read:

   - `AGENTS.md`
   - `docs/current/README.md`
   - The relevant plan under `docs/plans`, if the slice is already planned

3. Identify the changed surface:

   - Core only
   - One adapter
   - All adapters
   - Playground
   - Docs
   - Release/package metadata

4. Pick verification from `docs/current/verification.md`.

## Resume Packet Template

```text
Continue work in Tiptap Vue Pro.

Workspace: <absolute workspace path>
Branch: <branch>
Slice: <feature or maintenance slice>

Read first:
- AGENTS.md
- docs/current/README.md
- <relevant docs/plans file, if any>

Completed:
- <what changed>
- Verification: <commands and result>

Next:
- <specific next task>

Open decisions:
- <none or specific decision needed>
```

## Handoff Notes Rule

When a run changes stable project facts, update the relevant file in
`docs/current`. When a run only completes a feature task, keep detailed notes in
the feature plan, commit message, PR description, or final report instead.
