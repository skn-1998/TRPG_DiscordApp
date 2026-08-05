# Refactoring playbook

## Code smell mapping

| Smell | Signal | Candidate refactoring |
|---|---|---|
| Long Method | one function mixes multiple responsibilities | Extract Function, Replace Temp with Query |
| Duplicated Code | same condition, conversion, or workflow repeats | Extract Function, Pull Up Method |
| Large Class / Module | module has multiple reasons to change | Extract Class, Move Function |
| Feature Envy | function manipulates another module's internals | Move Function, Encapsulate Record |
| Shotgun Surgery | small behavior change requires many edits | Move Function, Introduce Facade |
| Complex Conditional | nested or repeated condition logic | Decompose Conditional, Guard Clauses, Strategy |
| Primitive Obsession | raw strings/numbers represent domain concepts | Replace Primitive with Object, Introduce Value Object |

## Invariants to list before editing

- API request/response fields, types, and status codes
- error types, error messages, and retry behavior
- auth, permission, ownership, and tenant boundaries
- database transaction boundaries and persistence format
- emitted events, notifications, audit logs, and metrics
- sorting, pagination, filtering, and default values
- concurrency behavior and idempotency

## Test-first refactoring flow

1. Confirm current test baseline.
2. Add characterization tests for unprotected behavior.
3. Make one structural change.
4. Run targeted tests.
5. Repeat in small steps.
6. Run broader validation before completion.

## Mikado-style planning

For tangled changes, identify the desired end state and recursively list prerequisites. Execute leaf changes first. If a prerequisite is too risky, split it or add a safety test before editing production code.

## Handling complexity metrics

Cyclomatic complexity, duplication, coupling, function length, test fragility, and change frequency are signals, not absolute goals. A lower number is not automatically better if the result hides domain logic or increases indirection.

## Safe split examples

Large conditional refactor:

1. Add tests for each branch.
2. Extract branch predicates into named functions.
3. Replace nested branches with guard clauses.
4. Extract side-effectful actions.
5. Consider strategy/polymorphism only if variants are stable and expected to grow.

Duplicate workflow refactor:

1. Confirm duplicate blocks truly have the same behavior.
2. Add tests around both call sites.
3. Extract the smallest shared pure function.
4. Migrate one call site.
5. Validate.
6. Migrate the next call site.

## Stop conditions

Stop and request review when:

- the plan requires a public API or schema change
- tests reveal behavior not captured in the plan
- the abstraction makes domain rules less visible
- the refactor affects auth, billing, audit logging, or data retention
- the diff is no longer reviewable as a small change
