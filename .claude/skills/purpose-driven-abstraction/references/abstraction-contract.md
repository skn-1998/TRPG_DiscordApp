# Purpose-Driven Abstraction Contract

Use only comparison fields material to the consumer decision. Unknown semantics remain unknown.

## Case Record

```text
Concrete case:
Consumer:
Purpose and desired outcome:
Inputs accepted:
Observable result and meaning:
Failures and meaning:
Side effects:
Invariants or obligations:
Timing or ordering, when material:
Evidence and unknowns:
```

Do not infer semantic equivalence from a shared signature, inheritance, copied code, or identical current output.

## Common-Purpose Hypothesis

```text
Consumer and common purpose:
Cases considered:
Evidence supporting one purpose:
Counterevidence or purpose differences:
Common semantic obligations:
Implementation decisions that may vary:
Realistic change scenarios:
```

The abstraction belongs to its consumer purpose. A generic label such as `Processor`, `Common`, or `Base` is not a purpose statement.

## Inclusion Decision

- Include a case only when it can honor the same semantic obligations without optional operations, flag-driven meaning changes, or weakened guarantees.
- Exclude a case when its purpose, result meaning, failure meaning, side effects, or invariant obligations materially differ.
- Keep uncertainty explicit when authority is missing; do not force all supplied cases into one abstraction.

## Decision Actions

- `introduce`: no current abstraction, evidenced cases share one purpose and contract, and an evidenced consumer or change benefit justifies the abstraction.
- `retain`: the existing abstraction and included cases remain semantically coherent, and an evidenced consumer or change benefit still justifies its indirection or constraint.
- `narrow`: an existing abstraction has an evidenced coherent subset whose supported consumer or change benefit still justifies the remaining indirection or constraint after incompatible cases or operations are removed.
- `remove`: the existing abstraction has no benefit-backed coherent remainder because its purposes or semantics are incompatible, or because no supported benefit justifies retaining its indirection or constraint.
- `avoid`: when no current abstraction exists, keep concrete cases because no supported abstraction benefit exists.
- `insufficient-evidence`: the consumer purpose, semantic comparison, or abstraction benefit cannot support a decision.

Choose `narrow` over `remove` only when a benefit-backed coherent remainder is evidenced; otherwise choose `remove`.

Record compatibility and the keep-concrete alternative for every action except `insufficient-evidence`.

## Hidden Decisions

List only implementation decisions that can vary behind the common contract and are evidenced by a realistic scenario or existing variation among the supplied cases. Do not hide a domain distinction merely to reduce duplication.

## Status Test

Use `abstraction-supported` for an evidence-backed introduce, retain, narrow, remove, or avoid decision. Use `abstraction-incomplete` when the required purpose, semantics, or benefit evidence remains unavailable.
