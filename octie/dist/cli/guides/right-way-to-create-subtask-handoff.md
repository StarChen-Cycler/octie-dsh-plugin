# Right Way To Create Subtask Handoff

Use this flag when a researched follow-on body of work is large enough to deserve its own child Octie graph.

## Preconditions

Before creating a handoff, make sure:
- the problem has already been investigated
- the repo already has a root `.octie/` project
- the follow-on work is too large for one small atomic task
- there is a concrete evidence artifact or repo memo
- there are existing root tasks that define the contracts the child work must preserve

Do not use a handoff when:
- the work can stay in the current root graph
- the issue is not researched enough
- the child work would only be one small atomic task

## Handoff rules

Use these rules:
- create a parent handoff task in the root graph
- anchor the parent handoff task to completed baseline tasks
- do not approve the parent handoff task until the child closeout gate is complete

If the handoff touches compatibility or semantics:
- make non-regression guardrails the first child task
- restate preserved contracts in child notes and criteria
- do not leave contract preservation as a casual note only in the parent task

## Parent handoff task rules

The parent handoff task should include:
- action-verb title
- specific description of what the child project owns
- quantitative success criteria
- deliverables for the root handoff and child project existence
- blockers pointing to completed baseline tasks
- `--dependency-explanation` explaining why those baselines matter
- related files pointing to memo and affected code
- notes defining preserved contracts and phase boundaries

Parent success criteria must be observable.

Do not use vague wording like:
- `preserves semantics`

Use criteria that reference:
- actual files
- required note contents
- task counts
- exact artifacts

## Child backlog rules

Create the child backlog in this order:
1. guardrail task
2. primary implementation tasks
3. measurement or regression task
4. optional decision task if needed
5. child closeout gate

Use these rules:
- each child task must still be atomic
- titles need strong action verbs (full accepted list: `octie create -h`)
- criteria must be measurable
- notes should restate preserved contracts when drift risk is high
- the guardrail task should be the single ready entry task
- the closeout gate should be blocked on all child work

## Minimal command shape

```bash
octie list --format md
octie find --search "<topic>" --format md
octie get <baseline-id> --format md

octie handoff create --subproject-name <name> ...

octie --project .octie/subprojects/<name> list --graph --format md
octie --project .octie/subprojects/<name> graph validate --format md
octie --project .octie/subprojects/<name> find --without-blockers --format md
octie --project .octie/subprojects/<name> find --orphans --format md
octie get <parent-id> --format md
```

## Validation rules

After creation, verify:
- the parent handoff task is anchored to completed baseline tasks
- the child graph has exactly the intended ready entry task
- the child graph has no orphans
- the parent task is not approved early
