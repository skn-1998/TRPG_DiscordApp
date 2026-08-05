# Naming Decision Contract

Use this contract for one symbol or a tightly related set. Do not expand a naming question into a repository redesign.

## Evidence Frame

```text
Actor and purpose:
Context:
Established terminology:
Target responsibility or observable effect:
Symbol kind and scope:
Material members and usages:
Compatibility constraints:
Evidence and unknowns:
```

Current names are observations, not proof of meaning. Candidate generation may temporarily hide the current name to reduce anchoring; this is a local technique, not a mandatory multi-candidate exercise.

## Candidate Record

```text
Candidate name:
Purpose or effect expressed:
Context and terminology fit:
Responsibility and member fit:
Mechanism detail exposed or avoided:
Scope precision:
Material usage fit:
Compatibility impact:
Evidence, counterevidence, and unknowns:
Disposition: [retain / recommend / reject]
```

Prefer names that reveal observable intent and purpose at the symbol's abstraction level. A technical mechanism may be correct when the symbol's actual responsibility is technical; do not remove it by slogan.

Do not ban `Manager`, `Service`, `Data`, `Util`, or any other token universally. Reject a name only when evidence shows that it obscures or overstates the bounded responsibility.

## Decision Rules

- `keep`: the current name fits the supplied purpose, effect, scope, terminology, and material usages.
- `rename-recommended`: a candidate is materially more intention-revealing and does not conceal a boundary mismatch.
- `boundary-blocked`: one name cannot honestly fit the evidenced responsibilities; report the mismatch but do not design the split.
- `terminology-blocked`: material domain terminology or meaning is disputed or absent; do not invent a canonical word.
- `insufficient-evidence`: no supported naming or blocker decision can be made from the bounded evidence.

`boundary-blocked` and `terminology-blocked` are terminal. Return the evidenced blocker and handoff without candidate names, replacement terminology, split-unit names, or a secondary keep/rename decision.

## Compatibility Surface

Record only evidenced or readily discoverable affected surfaces: definitions, direct callers, public APIs, persisted or serialized names, schemas, logs, metrics, configuration, and documentation. This is impact identification, not a complete rename plan or exhaustive search requirement.

## Status Test

Use `naming-supported` for a justified keep, rename, boundary-blocked, or terminology-blocked decision. Use `naming-incomplete` only for insufficient evidence.
