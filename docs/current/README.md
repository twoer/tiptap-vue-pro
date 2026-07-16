# Current Project Context

This directory is the lightweight current-state control plane for Tiptap Vue Pro.
It records facts and rules that should help the next development session start
from the real project state instead of from chat history.

It intentionally does not import the full project-harness toolkit. Keep this
directory small, current, and tied to this repository.

## Quick Entry

| Scenario | Read |
| --- | --- |
| Understand the product and architecture | [project-context.md](project-context.md) |
| Find the owning package for a change | [work-map.md](work-map.md) |
| Pick or resume the next feature slice | [roadmap.md](roadmap.md) |
| Choose the right checks before handoff | [verification.md](verification.md) |
| Check stable project decisions | [decisions.md](decisions.md) |
| Resume from a clean context | [handoff.md](handoff.md) |

## Current Docs Rules

- Keep only facts that still affect the next round of work.
- Keep implementation plans, completed slice notes, and large task breakdowns in
  `docs/plans`, not here.
- Update this directory when a stable architecture decision, workflow rule,
  verification lane, or priority changes.
- Do not update it for routine small fixes that do not change future work.
