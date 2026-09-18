# Convergence Round Baseline (guardrail)

> Captured 2026-09-18 on the **unmodified** octie-cli 1.2.4 codebase (`node octie/dist/cli/index.js`, version output: `1.2.4`).
> Purpose: non-regression evidence for spec_octie-收敛改进. Items B1/C1 must reproduce these outputs **byte-identically** after their changes land; item A1 must keep the fixtures in this directory loading.

## Fixture inventory

| File | Content |
|---|---|
| `old-format-project.json` | `format: octie-project`, 2 real-derived tasks, 3 need_fix items using `completed: boolean` (true ×1, false ×2; one minimal item without `file_path`/`source`) |
| `old-snapshot.json` | Same 6-key shape as `.octie/history/snapshots/<uuid>.json`, same boolean need_fix items |

Load guard: `tests/unit/core/models/old-format-fixture.test.ts` (5 tests, passing) runs every fixture task through `TaskNode.fromJSON` and checks a `toJSON` round-trip.

---

## 1. CLI `get --fields` baseline

Command: `octie get 39a4b591 --format json --fields status,title` (scratch project, one probe task)

```json
{
  "status": "ready",
  "title": "Create baseline probe task for field filtering"
}
```

Command: `octie get 39a4b591 --format md --fields status,blockers,success_criteria`

```md
## [ ] Create baseline probe task for field filtering

**ID**: `39a4b591-4739-4243-a301-6f7ed3768125` | **Status**: ready | **Priority**: second

### Description
Probe task used to capture the baseline output of CLI field filtering for the convergence guardrail round.

### Success Criteria
- [ ] octie get --fields returns exactly the requested 2 fields `8300f9eb-7199-46a9-a3b0-c7687574a2f1`

### Deliverables
- [ ] baseline.md recording `d7699364-82d4-46f8-804c-acbb04ad8605`

---
**Created**: 2026-09-18T15:00:11.014Z
**Updated**: 2026-09-18T15:00:11.014Z
```

**Recorded quirk**: `--format md` does **not** narrow the body to the requested fields (description/deliverables/timestamps still render); `--format json` filters exactly. C1's shared-extraction must preserve this per-format behavior, not "fix" it.

## 2. CLI atomic-validation violation list baseline

Command: `octie create --title "Create thing" --description "..." --success-criterion "it works" --deliverable "实现一个功能"`

```
✗ Task "Create thing" violates atomic task requirements.

Specific issues found:
  ✗ Deliverables must be specific. Include file paths (e.g., "src/auth/login.ts") or specific outputs (e.g., "POST /auth/login endpoint"). Avoid vague terms like "code", "implementation", "feature".

ℹ Run 'octie create -h' to see the full atomic task policy.
```

Exit code: 1. B1 must keep this CLI output intact while surfacing the same violation detail through the DSH tool error path.

## 3. DSH tool surface baseline (13 `octie_*` tools)

Extracted from `plugin/index.mjs` `buildTools()` (parameter keys, top level):

| Tool | Parameters |
|---|---|
| `octie_init` | name, path |
| `octie_create` | title, description, successCriteria, deliverables, priority, blockers, dependencyExplanation, relatedFiles, notes |
| `octie_list` | status, priority |
| `octie_get` | id |
| `octie_find` | title, search, hasFile, verified, withoutBlockers, orphans, leaves, status, priority |
| `octie_update` | id, priority, completeCriteria, completeDeliverables, completeNeedFix, addNeedFix, addSuccessCriteria, addDeliverables, notes, blockers, dependencyExplanation, unblock |
| `octie_approve` | id |
| `octie_wire` | id, after, before, depOnAfter, depOnBefore |
| `octie_merge` | source, target |
| `octie_delete` | id, mode |
| `octie_graph` | validate |
| `octie_history` | action, snapshotId |
| `octie_handoff` | subprojectName, title, description, successCriteria, deliverables, priority |

Round-relevant observations (recorded, not actioned here):

- `octie_get` has **no** `fields` parameter today — C1 adds it.
- `octie_update` has **no** delete-criterion/deliverable parameters — C2 adds them; it already has `blockers` as a **single** `stringParam` ("One blocker task ID to add") — B2's type-error fix targets this path.
- need_fix completion exists (`completeNeedFix`) but no withdraw action — A1 adds it (≤3 new tool actions budget: withdraw, fields, delete ×2-in-1).

---

## Addendum 2026-09-18 (post-B1): enriched atomic error output

B1 intentionally changed the violation text (per-entry location). New CLI output for the same probe command:

```
✗ Task "Create thing" violates atomic task requirements.

Specific issues found:
  ✗ Deliverable[0] "实现一个功能" is not specific. Include a file path (e.g., "src/auth/login.ts") or a specific output (e.g., "POST /auth/login endpoint"). Avoid vague terms like "code", "implementation", "feature".

ℹ Run 'octie create -h' to see the full atomic task policy.
```

Structure preserved (error line → "Specific issues found:" → full list → policy hint); each violation now carries field + entry index + excerpt. The DSH tool path surfaces the same list in `err.message` (plugin/index.mjs `rethrowWithViolationDetails`).

Post-A1 tool-surface additions (within the ≤3 new actions budget): `octie_update` gained `withdrawNeedFix` (A1), `removeCriteria` + `removeDeliverables` (C2); `octie_get` gained `fields` (C1).
