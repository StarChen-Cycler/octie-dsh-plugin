# Right Way To Use Notes And Files

Use this flag when deciding where task information belongs in Octie.

## Placement rules

Use success criteria for:
- measurable obligations
- pass/fail checks
- validation targets

Use deliverables for:
- concrete outputs
- files
- endpoints
- schemas
- tests
- docs
- scripts
- migrations

Use related files for:
- paths directly relevant to implementation
- files likely to be read or modified

Use notes for:
- assumptions
- constraints
- rationale
- discoveries
- inspirations — capture useful ideas that arise during task creation or implementation
- notable changes — record meaningful decisions, scope shifts, or important observations
- supporting context that does not belong in criteria or deliverables

⚠️ Add notes proactively. If something notable occurs during task work — an insight, a pivot, a surprising finding — run `octie update <id> --notes "<note>"` to capture it. Notes are the living context of a task; sparse notes mean lost knowledge.

Use criterion evidence for:
- proof that a specific success criterion was met (benchmark numbers, test output excerpts, measured values)

Record evidence at completion time, not in notes:

```bash
octie update <id> --complete-criterion <criterion-id> --evidence "0.86 ms median, n=810"
```

Evidence stays attached to the criterion it proves; notes are for context, not per-criterion verification data.

Use C7 verification for:
- external documentation-backed implementation patterns
- library-specific guidance already verified

## Example usage

```bash
octie create \
  --title "Implement <specific objective>" \
  --description "Implement <specific scoped objective> within the prepared requirements, verified patterns, and known constraints." \
  --success-criterion "<measurable criterion 1>" \
  --success-criterion "<measurable criterion 2>" \
  --success-criterion "<measurable criterion 3>" \
  --success-criterion "<measurable criterion 4>" \
  --success-criterion "<measurable criterion 5>" \
  --deliverable "<concrete output 1>" \
  --deliverable "<concrete output 2>" \
  --deliverable "<concrete output 3>" \
  --deliverable "<concrete output 4>" \
  --deliverable "<concrete output 5>" \
  --related-files "<path1>,<path2>" \
  --c7-verified "<library:pattern>" \
  --notes "<supporting context>" \
  --priority <top|second|later>
```

## Do not

- do not hide real requirements in notes
- do not use deliverables for vague intentions
- do not use related files as a substitute for deliverables
- do not put structural dependency logic in notes when it belongs in dependency fields
