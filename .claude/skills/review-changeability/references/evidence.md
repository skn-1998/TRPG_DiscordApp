# Evidence basis for Review Changeability

Use this ledger to audit the skill's definitions and review method. The core procedure is intentionally scenario-based and measures change impact; it does not treat readability or cognitive effort as a synonym for modifiability.

## Source-to-rule mapping

| Skill rule | Primary or authoritative source | How it is used |
|---|---|---|
| Evaluate product quality through explicit characteristics and measures | [ISO/IEC 25010:2023 product quality model](https://www.iso.org/standard/78176.html) | Establishes the current SQuaRE product-quality model as a specification and evaluation framework. The skill uses modifiability as its standards-aligned quality target, while avoiding a claim about overall maintainability. |
| Define a concrete change with source, stimulus, environment, artifact, response, and response measure | [SEI, Achieving Product Qualities Through Software Architecture Practices](https://www.sei.cmu.edu/documents/2993/2004_017_001_22862.pdf), pp. 26-32 | Supplies the six-part quality-attribute scenario. Its modifiability example measures affected components, effort/cost, side effects, testing effort, and deployment effort. |
| Judge tactics through their effect on modification cost rather than pattern names | [Bachmann, Bass, and Nord, Modifiability Tactics, CMU/SEI-2007-TR-002](https://www.sei.cmu.edu/library/modifiability-tactics/) | Models modifiability tactics through responsibility cost, cohesion, coupling, and deferred binding. The report explicitly treats tactics as design decisions that adjust quality-attribute model parameters. |
| Hide likely change decisions so one change does not force unrelated module changes | [Parnas, On the Criteria To Be Used in Decomposing Systems into Modules](https://doi.org/10.1145/361598.361623) | Provides the information-hiding basis for decomposing around design decisions likely to change, instead of decomposing mechanically by processing steps. |
| Prefer actual change effort/history over static structural impressions | [Arisholm, Briand, and Foyen, Empirical assessment of the impact of structural properties on the changeability of object-oriented software](https://doi.org/10.1016/j.infsof.2006.01.002) | Defines changeability in terms of low effort for actual changes and evaluates structural indicators using industrial project change-effort and history data. Supports using history as evidence and treating static structure only as an indicator. |

## Derived operating rules

The following are engineering operationalizations of the sources, not standardized universal metrics:

- Count edited production artifacts, propagated edits, affected contracts/consumers, verification/deployment steps, and migration/rollback actions for the same scenario before and after a proposal.
- Distinguish the primary edit from secondary edits needed to preserve consistency. This makes change amplification visible without treating every multi-file change as a defect.
- Use git, issues, incidents, and roadmap items to classify scenario evidence. A hypothetical scenario may reveal a risk, but receives lower priority unless its consequence is severe.
- Treat cognitive load as a separate human-factor cost. It may affect total change effort, but concepts, hops, working-memory items, and readability are measured by `cognitive-load-review`, not duplicated here.
- Require a two-axis result when a tactic reduces propagation but introduces mental overhead. The combined accept/revise/reject decision is a local policy for avoiding one-dimensional optimization; it is not claimed as an ISO rule.

## Limits

- ISO/IEC 25010:2023 is the current edition, but its complete normative text is not reproduced here. Consult the licensed standard when exact conformity wording is required.
- SEI tactics are candidates whose value depends on the selected scenario. The existence of coupling, a wrapper, an intermediary, or a layer does not by itself prove good or poor modifiability.
- The Arisholm et al. study is an industrial empirical study of object-oriented software, not a universal calibration for all languages or systems. This skill therefore uses counts comparatively and sets no universal numeric threshold.
