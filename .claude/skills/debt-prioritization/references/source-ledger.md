# Source Ledger

Sources support design and prioritization claims; they do not justify a universal score, owner gate, test plan, or remediation workflow.

## Primary MinoDriven Sources

### M1. Ghosts of Technical Debt

- URL: https://speakerdeck.com/minodriven/ghosts-of-technical-debt
- Verified: 2026-07-16; the public transcript identifies MinoDriven and describes technical debt as a gap from a modifiable structure, makes changeability the refactoring goal, and organizes a means around one purpose.
- Supports: compare debt against a stated modifiability outcome rather than appearance alone; keep Purpose relevant to the desired structure.
- Limits: does not define a prioritization formula, portfolio schema, mandatory owner, or fixed evidence checklist.

### M2. Architecture-Level Development Productivity

- URL: https://speakerdeck.com/minodriven/architecture-and-productivity
- Verified: 2026-07-16; the transcript states that development resources are finite, defines core domains through competitive value, calls for discussion with domain experts, and recommends preferential investment in the core.
- Supports: use evidenced core or business relevance when allocating limited capacity and recognize that core status can change.
- Limits: a module name, code location, or AI inference does not establish core-domain status. The source does not rank individual debt items or assign numeric weights.

### M3. Modifius

- URL: https://speakerdeck.com/minodriven/modifius
- Verified: 2026-07-16; the transcript contrasts line count, cyclomatic complexity, duplication, and argument count with intent-sensitive design concerns such as encapsulation, separation of concerns, domain-model completeness, layers, patterns, and interfaces.
- Supports: static metrics alone cannot establish the purpose or design significance of a debt item.
- Limits: the deck mentions a custom scoring formula but does not publish a general prioritization formula. This Skill does not reconstruct or treat that score as business priority.

## Complementary Sources

### F1. Martin Fowler, Technical Debt Quadrant

- URL: https://martinfowler.com/bliki/TechnicalDebtQuadrant.html
- Verified: 2026-07-16; Fowler explains principal and interest tradeoffs and notes that debt in a rarely touched area may not be worth paying down when its interest is small.
- Supports: compare expected interest and future touch against remediation cost; allow a contextual defer decision.
- Limits: the quadrant classifies debt circumstances; it is not a universal ranking formula.

### T1. Adam Tornhill, Prioritizing Technical Debt as if Time and Money Mattered

- URL: https://speakerdeck.com/adamtornhill/prioritizing-technical-debt-as-if-time-and-money-mattered
- Verified: 2026-07-16; the transcript combines code complexity with change frequency as hotspots, uses version-control and defect data, and argues that not all debt should be fixed.
- Supports: use change history and structural difficulty to focus investigation and avoid treating all code equally.
- Limits: a hotspot is not proof of stakeholder value, future roadmap demand, root cause, or remediation payoff.

### S1. Carnegie Mellon Software Engineering Institute, Data-Driven Management of Technical Debt

- URL: https://www.sei.cmu.edu/blog/data-driven-management-of-technical-debt/
- Verified: 2026-07-16; SEI describes correlating issue trackers, repository history, static analysis, bug churn, change churn, size, and developer feedback to identify and rank candidate items.
- Supports: combine qualitative and quantitative evidence from multiple sources and connect debt to anticipated change and impact.
- Limits: candidate analytics provide decision evidence, not an automatic business decision or proof that one metric generalizes to every system.

## Skill Architecture

### O1. OpenAI Skill Creator

- URL: https://github.com/openai/skills/blob/main/skills/.system/skill-creator/SKILL.md
- Verified: 2026-07-16; the official guidance favors concise runtime instructions, progressive disclosure, realistic forward tests, and references for detailed knowledge.
- Supports: keep the direct workflow in `SKILL.md` and source detail in references.
- Limits: it defines Skill packaging and iteration, not technical-debt identification or priority criteria.

### C1. inspired-mino-design-skills

- Repository: https://github.com/my-take-dev/inspired-mino-design-skills/tree/afd50e2ca18bb22e336a05df1c8481dbcd652b5c
- Relevant file: `mino-doc/04-technical-debt-goal-and-prioritization.md`.
- Role: pinned, unofficial comparator supplied by the user.
- Adopt: distinguish signals from design and impact evidence; use business relevance, expected change, debt consequence, risk, cost, and explicit defer options as qualitative comparison lenses.
- Do not adopt: its multiplicative concept formula, exhaustive ledger, mandatory owner, safe-step plan, tests, prevention program, review cadence, or fixed output schema as universal production requirements.
- Limits: it is not evidence for claims attributed directly to MinoDriven.

## Local Architecture Decisions

- the child accepts Actor, Purpose, Context, Constraints, and Evidence directly;
- the child compares a bounded candidate set and does not perform open-ended discovery or remediation;
- criteria are selected from the current decision rather than imposed as fixed weighted fields;
- evidence statements retain provenance, scope, time window, counterevidence, and unknowns when consequential;
- `recommendation-supported` and `decision-incomplete` distinguish a usable choice from fabricated certainty;
- no human owner, independent reviewer, approval gate, test, rollout, release, rollback, branch, commit, review cadence, or prevention plan is universally required for a comparison artifact.

## Source Policy

Qiita and Zenn are excluded, including links or quotations embedded in otherwise accepted sources. Preserve source limits and conflicts.
