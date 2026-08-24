# Adoption Tracking

Status: active
Started: 2026-08-24

## Purpose

Track whether Tiptap Vue Pro is moving from downloads and curiosity into real
adoption. This file should stay factual: record signals, caveats, and the next
review questions. Do not treat npm downloads as unique users.

## Baseline

Recorded on 2026-08-24 using npm downloads through 2026-08-23, excluding the
incomplete current day.

| Package | Last 7 days | Last 30 days |
| --- | ---: | ---: |
| `tiptap-vue-pro-core` | 547 | 1,134 |
| `tiptap-vue-pro-element-plus` | 438 | 937 |
| `tiptap-vue-pro-naive` | 411 | 912 |
| `tiptap-vue-pro-ant-design-vue` | 417 | 920 |
| Total | 1,813 | 3,903 |

Adapter-only totals:

| Range | Downloads |
| --- | ---: |
| Last 7 days | 1,266 |
| Last 30 days | 2,769 |

## Caveats

- npm downloads are package downloads, not unique users or production installs.
- CI, lockfile refreshes, registry scanners, repeated installs, and release-day
  spikes can inflate counts.
- `tiptap-vue-pro-core` is installed as a dependency of every adapter, so core
  downloads should not be interpreted as standalone adoption.
- Adapter downloads are the better npm signal for real evaluation, but still
  need qualitative feedback to prove production use.

## Community Feedback

- QQ group: `1108178997`.
- QQ group docs entry was deployed in commit `4c358b0`.
- GitHub Issues before this iteration: 0 open issues.
- GitHub repository baseline on 2026-08-24: 6 stars, 2 forks, 0 watchers.

## Current Adoption Iteration

The first productization pass focuses on first-run confidence rather than new
editor features:

- Sharpen README positioning and package choice.
- Improve Quick Start for the first 3-5 minutes.
- Add realistic business examples for admin forms, knowledge-base editing, and
  uploads.
- Add GitHub Issue templates for bug reports and usage scenarios.

## Questions To Answer

- Do adapter downloads stay non-zero outside release-spike days?
- Do QQ group members ask concrete integration questions?
- Do GitHub Issues include reproducible bugs or real use cases?
- Which docs pages are visited after users land from README or npm?
- Are users blocked by docs/examples, package installation, UI adapter behavior,
  or missing editor features?

## Next Review

Review again 2-4 weeks after this productization pass is deployed.

Use these checks:

```bash
node - <<'NODE'
const pkgs = [
  'tiptap-vue-pro-core',
  'tiptap-vue-pro-element-plus',
  'tiptap-vue-pro-naive',
  'tiptap-vue-pro-ant-design-vue',
]
const range = 'YYYY-MM-DD:YYYY-MM-DD'
for (const pkg of pkgs) {
  const res = await fetch(`https://api.npmjs.org/downloads/point/${range}/${pkg}`)
  const data = await res.json()
  console.log(pkg, data.downloads)
}
NODE
```

Decision rule:

- If there are concrete integration questions, improve the matching docs and
  examples first.
- If there are reproducible bugs, prioritize stability before new features.
- If there is no feedback and adapter downloads decay, reduce iteration
  frequency and keep the project in maintenance mode.
