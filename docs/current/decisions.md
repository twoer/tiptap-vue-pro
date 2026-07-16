# Decisions

Status: active

This file records stable decisions that should guide future work. It is not a
daily log.

## Active Decisions

### Keep Core UI-Free

Shared behavior, commands, Tiptap extensions, upload orchestration, Markdown,
diagnostics, and type contracts live in `packages/core`. UI components and
library-specific rendering live in adapter packages.

### Keep The Three Adapters Honest

Element Plus, Naive UI, and Ant Design Vue adapters should provide equivalent
editor behavior while using their own UI library naming, components, selectors,
and variables.

### Prefer Focused Verification

For normal feature work, run package-level typecheck/test commands that match the
changed surface. Use full workspace build/test and docs build for release-level
handoff or broad changes.

### Keep Current Docs Lightweight

`docs/current` is a current-state control plane. It should not become a generated
project harness, a task log, or a duplicate of `docs/plans`.

### Treat Slash Command As Planned, Not Implemented

The current slash command document under `docs/plans` is an implementation plan.
Before coding, refresh assumptions against the current dependencies and adapter
state.

## Protected Decisions

Ask before changing:

- Package names, public exports, or peer dependency policy.
- The core/adapter boundary.
- Published API shape for props, commands, or diagnostics.
- Documentation site structure or deployment behavior.
- Whether to adopt a full harness toolkit, plugin, or generated check suite.
