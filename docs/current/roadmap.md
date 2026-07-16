# Current Roadmap

Status: active

This file keeps near-term priorities visible. Detailed implementation plans stay
in `docs/plans`.

## Current Priority

1. Keep adapter parity and regression coverage strong before adding more editor
   surface area.
2. Keep recently completed Slash Command, table resizing, Find/Replace, and
   image crop behavior aligned across docs, tests, playground, and release
   packaging.
3. Keep developer diagnostics, media upload, table interactions, and docs aligned
   across core, adapters, playground, and VitePress docs.

## Ready Slices

| Slice | Why It Matters | Starting Point | Verification |
| --- | --- | --- | --- |
| Mention command | Modern collaboration baseline; needs a host-provided data-source contract | `docs/feature-gap-analysis.md` | Core and adapter typecheck/test, boundary checks |
| Adapter interaction test expansion | Reduces regression risk in image, table, Markdown, and popup flows | `docs/feature-gap-analysis.md` | Target package tests plus boundary checks |
| Docs and examples polish | Keeps public API and demo usage trustworthy | `docs/`, `docs/en/`, package READMEs | `pnpm docs:build:site`, package typecheck where examples imply API |
| Release readiness pass | Ensures packages, playground, and docs match before publishing | Root README, package metadata, docs site | Root build/test lanes plus docs build |

## Recently Landed

| Slice | Notes |
| --- | --- |
| Image crop before upload | Implemented across core, Element Plus, Naive UI, Ant Design Vue, playground, docs, and image-crop smoke coverage. |
| Find/Replace panel polish | Panel stays pinned while matches scroll; toolbar-style icon spacing and Element Plus button margin resets are covered by tests and smoke checks. |

## Deferred Or Protected Work

- Collaboration, math, mention, and other larger editor capabilities should
  get a fresh plan before implementation.
- Public package naming, package split, peer dependency policy, and published API
  shape are protected decisions. Ask before changing them.
- Do not adopt a full external harness, plugin, or generated checks directory
  without a separate project-maintenance decision.
