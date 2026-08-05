# Coding rule catalog

Use this catalog to expand or tailor AI-facing coding standards.

## Must candidates

- Preserve existing architecture boundaries and dependency direction.
- Do not accept a change solely because tests pass or no bug is observed; reject unjustified increases in cognitive load or maintenance surface.
- Validate external input at API, form, file, webhook, environment variable, and database boundaries.
- Never hard-code secrets, credentials, private keys, tokens, or personal data.
- Explain and request approval before adding production dependencies.
- Explain and request approval before changing public APIs, auth/permission behavior, migrations, billing, or notification behavior.
- Add or update tests for behavior changes.
- Report validation commands run and checks not run.
- Do not use placeholder comments to omit code.
- Do not invent files, commands, APIs, libraries, or configuration values.

## Should candidates

- Keep functions small and responsibility-focused.
- Prefer guard clauses over deeply nested conditionals.
- Prefer intention-revealing names; boolean names should start with `is`, `has`, `can`, `should`, or `needs` when appropriate.
- Keep related definitions, conditions, and uses close enough to understand without jumping between distant files or sections.
- Represent mutually exclusive states with one explicit state value instead of combinations of loosely related booleans.
- Keep each function at a consistent level of abstraction; separate domain decisions from low-level transport, parsing, or collection mechanics.
- Comment on reasons and constraints rather than restating code.
- Reuse existing domain concepts and utilities.
- Prefer explicit error handling over silent fallback.
- Add characterization tests before refactoring poorly covered code.

## Avoid candidates

- Broad rewrites unrelated to the task.
- Speculative abstraction or one-off generic frameworks.
- Adding dependencies without a clear maintenance/security/bundle/licensing justification.
- Global mutable state and hidden side effects.
- Dense expressions that are shorter but require readers to mentally decode multiple operations or implicit assumptions.
- Changing generated files without updating the generation source.
- Replacing existing project style with fashionable but inconsistent patterns.

## Category checklist

- correctness: behavior, edge cases, error handling, concurrency, data integrity
- readability: naming, locality, function size, duplication, comments, dead code
- maintainability: boundaries, dependency direction, coupling, migrations, extension points
- consistency: existing patterns, formatting, linting, typing, folder conventions
- tests: unit, integration, regression, characterization, fixtures, mocks, coverage expectations
- security: secrets, input validation, authorization, injection, unsafe deserialization, dependency risk
- operations: logging, metrics, configuration, performance, resource usage, rollback plan
- collaboration: small changes, PR description, commit style, documentation, reviewer notes

## Cognitive load checks

Treat cognitive load as the amount of information a reader must hold, track, or infer at the same time. Do not use line count alone as a readability measure; explicit code may be easier to understand than shorter implicit code.

Check whether a reader can follow the code without:

- remembering several nested conditions at once
- reconstructing the meaning of vague names such as `data`, `flag`, `tmp`, or `result`
- deriving valid states from combinations of independent booleans
- searching distant files for directly related definitions or effects
- mixing domain intent with low-level implementation details in the same flow
- guessing about mutation, global state, defaults, conversions, or other hidden side effects

Prefer intention-revealing names, guard clauses, responsibility-focused functions, explicit state models, local reasoning, consistent abstraction levels, and comments that explain reasons or constraints.

When proposing a rule or review finding, identify the concrete mental burden instead of saying only "this is hard to read." State what must be remembered, tracked, inferred, or searched for, and suggest the smallest change that removes that burden.

### Cognitive-load delta after implementation

Compare the changed implementation with the pre-change implementation. Passing tests proves only the checked behavior; it does not justify making the code harder to understand.

Inventory newly introduced variables, parameters, flags, states, branches, aliases, caches, intermediate objects, and abstractions. For each one, check whether it:

- names a distinct and necessary domain or implementation concept
- has the narrowest practical scope and lifetime
- replaces repeated reasoning, a dense expression, hidden behavior, or a more difficult concept
- duplicates another value or stores something cheaply and reliably derivable without improving clarity
- mirrors another state and therefore creates a synchronization invariant
- increases the valid or invalid combinations a reader must reason about
- forces readers to trace assignments across branches or time before understanding its value
- uses a name that explains its purpose rather than only its representation or processing step

Classify the result as **reduced**, **unchanged**, **justified increase**, or **unjustified increase** in cognitive load. Require a concrete benefit for a justified increase, such as representing an unavoidable domain state, separating abstraction levels, making side effects explicit, or removing greater branching or duplication.

Do not use variable count as the metric. A named intermediate can lower cognitive load when it exposes intent and remains local and immutable. Conversely, one added boolean can sharply raise cognitive load when it creates implicit state combinations or must remain synchronized with another value.

When the change adds cognitive load without a corresponding requirement or larger simplification, request the smallest revision that removes the new tracking burden even if all validation passes.

## Repository-scale maintainability review

Run this review after implementation. Inspect beyond the changed files and use repository search, call sites, imports, tests, and module boundaries as evidence. Scale the search to the likely reach of the changed responsibility.

Check whether the implementation:

- introduces a function, helper, service, component, fixture, configuration path, or abstraction that is semantically equivalent to an existing one, even when names and syntax differ
- creates another owner for a responsibility already owned elsewhere or makes callers choose between competing entry points
- bypasses an existing extension point, shared domain concept, or established module without a responsibility or contract reason
- places behavior in the wrong layer, reverses dependency direction, or leaks transport, framework, environment, or test details across an architecture boundary
- spreads one likely future change across avoidable locations, or requires synchronized edits that the design does not make explicit
- adds parallel state, configuration, validation, error mapping, lifecycle handling, or orchestration that can drift from the existing path
- leaves obsolete paths, superseded helpers, dead abstractions, or inconsistent tests and documentation after consolidation
- creates a locally tidy implementation at the cost of repository-wide inconsistency or a larger maintenance surface

Do not treat textual similarity alone as duplication. Compare purpose, responsibility, contract, dependencies, lifecycle, and reasons to change. Reuse or consolidate when these align; extend an existing owner when its contract can naturally own the behavior; keep implementations separate when combining them would couple distinct responsibilities or change rhythms.

For each finding, cite the affected symbols or paths and the maintenance consequence. For each non-obvious decision to keep similar implementations separate, record why separation is safer. Report the search scope and evidence; do not claim repository-wide absence from inspecting only the diff.

## Good rule pattern

Bad:

```markdown
Write clean code.
```

Good:

```markdown
Split functions that mix validation, persistence, rendering, and external communication unless keeping them together is simpler and the reason is documented.
```

## Background separation pattern

Keep active rules short:

```markdown
1. Never use placeholder comments to omit unchanged code.
```

Put rationale and examples in a background file:

```markdown
## 1. Placeholder comments
AI-generated placeholders can cause incomplete patches or broken files when applied automatically.
```
