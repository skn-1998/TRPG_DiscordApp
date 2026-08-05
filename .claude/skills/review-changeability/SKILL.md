---
name: review-changeability
description: >-
  Review code, diffs, designs, and refactor proposals for scenario-specific modifiability:
  change propagation, affected artifacts and contracts, implementation and verification effort,
  side-effect risk, compatibility, and recovery. Runs two grains — small (scenario propagation
  trace) and large (a scenario-independent reuse & duplication sweep that checks whether new
  code duplicates an existing function/helper or fails to reuse an established one, and whether
  near-identical copies will drift). Use for code, PR, design, or refactor reviews that ask
  whether a concrete future change can be made locally, safely, and efficiently, or whether an
  implementation duplicated existing code. Pair with cognitive-load-review when overall
  maintainability, readability, complexity, or abstraction cost is in scope; do not use this
  skill to judge comprehension or mental effort.
---

# Review Changeability

## Purpose and boundary

Review how effectively and efficiently a product can absorb a **specified change** without defects or degradation. Treat changeability as a response to a change scenario, not as a general impression that code is "clean" or "maintainable."

Keep this review separate from cognitive load:

- This skill measures the change's propagation, effort, verification surface, compatibility effects, and side-effect risk.
- `cognitive-load-review` measures the concepts, hops, assumptions, and working-memory demand imposed on the person making the change.
- Do not report naming, readability, indirection, concept count, or comprehension difficulty as a changeability finding unless there is separate evidence that it expands the affected change surface or causes missed co-changes.
- Do not claim overall maintainability from this review alone. When a proposal adds an abstraction, layer, contract, pattern, or process, run both skills and report both deltas. A structural benefit does not cancel a cognitive-load cost.

See `references/evidence.md` when reviewing the method, resolving a disputed criterion, or explaining its source basis.

## Review workflow

1. Establish the target's runtime role, public and durable contracts, callers, dependencies, deployment unit, and existing tests from repository evidence.
2. Select one or two representative change scenarios from issue/roadmap evidence, recent git history, repeated defects, or a user-supplied requirement. Label an unsupported scenario as hypothetical.
3. Specify each scenario with: source, stimulus, environment, affected artifact, expected response, and measurable response target.
4. Trace the minimal correct change end to end. Count the initial edits, propagated edits, affected contracts and consumers, required migration/deployment actions, and verification scope.
5. Identify the mechanism causing each propagated edit: duplicated decision, unstable dependency, leaked representation, incompatible contract, shared mutable state, build/deploy coupling, or missing verification boundary.
6. Compare the current and proposed structures on the **same scenario**. Credit an abstraction only when it reduces measured impact or risk for that scenario.
7. Run the reuse & duplication sweep below (the large-grained pass). Do not finish on the scenario trace alone.
8. If the proposed direction adds concepts, indirection, hidden assumptions, or process steps, invoke `cognitive-load-review`. Keep its findings and verdict separate.
9. Report only evidence-backed changeability risks. Do not prescribe a design pattern from principle alone.

## Two grains — do both, do not stop at one

Every changeability review has two grains. A review that runs only one is incomplete.

- **Small grain (scenario propagation):** trace one or two concrete change scenarios end to end (steps 2–6). This catches "when X changes, how many owners must edit together."
- **Large grain (reuse & duplication sweep, scenario-independent):** proactively check whether the reviewed code **duplicates an existing function/helper or fails to reuse an established one**, and whether new near-identical copies were introduced that will drift. This does not need a specific change scenario — a shared-contract copy is a latent synchronized-edit obligation regardless of which scenario triggers it.

### Reuse & duplication sweep (grep-driven, mandatory for implementation/PR reviews)

1. For each new or changed function, parser, merge, validator, constant, or message builder, grep the codebase for pre-existing siblings with the same shape or purpose (e.g. a new `--user`/`--media` parser next to an existing `--bind`/`--impair` parser; a new flattening/traversal next to an existing one).
2. For each candidate pair/family, decide with the purpose-driven-abstraction discipline:
   - **Consolidate** only when one purpose AND one contract are genuinely shared and the copies will drift (a divergence silently breaks one caller). Quantify: how many near-identical copies, how many lines verbatim.
   - **Keep separate** when contracts genuinely differ (e.g. flat map vs slot-wise map) or the copies are expected to vary independently — say so explicitly. Duplication alone is never sufficient reason to merge.
3. Also check the inverse: did the new code **reinvent** logic that an existing shared helper already provides (bypassing it)? That is a reuse miss even without a second copy.
4. When recommending consolidation, require the extraction to be behavior-preserving and re-verified — extracting a shared helper can silently change one former copy's behavior (redaction, guards, edge cases). Flag that the consolidation itself needs a behavior-preservation check.

Corroboration: large-grained duplication usually also shows up in `cognitive-load-review` as non-local reading cost. When both skills flag the same copies, consolidation confidence is high.

## Required measurements

Use the smallest useful set, but include at least one direct change-cost or change-impact measure for every finding:

- Change surface: number and identity of production artifacts that must be edited together.
- Propagation: secondary edits required only to preserve consistency after the primary edit.
- Contract impact: public APIs, schemas, events, persisted data, configuration, fixtures, or external consumers affected.
- Verification surface: tests, builds, environments, manual checks, or deployments required to establish that behavior and quality remain intact.
- Side-effect exposure: unrelated behaviors or quality attributes that can be changed by the same edit.
- Delivery effort: observed effort when available; otherwise concrete steps and touched artifacts. Do not invent hours or story points.
- Recovery/compatibility: migration, rollback, coexistence, versioning, or feature-flag work required at a durable boundary.
- Frequency and evidence strength: observed occurrences and git/issue history. Use these to prioritize, not to manufacture a finding.

Counts are evidence, not universal thresholds. Interpret them relative to the scenario and the consequence of a missed change.

## Changeability findings

Flag a finding only when a concrete scenario shows one or more of these outcomes:

- One decision requires synchronized edits in multiple owners because its representation or rule is duplicated.
- New or changed code duplicates a shared-contract function/helper that already exists, or reinvents logic an existing shared helper provides (from the reuse & duplication sweep). Flag only when one purpose+contract is genuinely shared and the copies will drift; keep genuinely different-contract or independently-varying copies separate and say so.
- A local change propagates across components that do not share the changed responsibility.
- A private representation or sequencing choice has leaked into callers, fixtures, schemas, or operations.
- A contract change forces avoidable consumer migration or prevents safe coexistence/rollback.
- The smallest meaningful verification requires unrelated systems or broad end-to-end setup because the owning boundary lacks a testable contract.
- A shared dependency lets one consumer's change alter unrelated consumers or quality attributes.
- Build, configuration, deployment, or data migration coupling expands an otherwise local code change.
- Repository history shows recurring missed co-changes, regressions, or repeated manual synchronization.

Do not flag a finding solely because:

- Code is long, unfamiliar, indirect, or cognitively demanding. Route that evidence to `cognitive-load-review`.
- Responsibilities, cohesion, coupling, DRY, SOLID, layers, or patterns violate a preferred principle. Principles are hypotheses until a scenario shows impact.
- An abstraction could support an imagined variant with no roadmap, history, or stated requirement.
- More than one file changes when those files form one owned unit and are versioned, tested, and released atomically.
- Some duplication exists but the duplicated code is expected to vary independently.
- A simple local implementation is less generic than a possible framework.

## Recommendation constraints

- Prefer the smallest intervention that reduces the measured propagation mechanism.
- Preserve independent variation. Do not centralize code merely because its current shape matches.
- Treat encapsulation, wrappers, intermediaries, shared services, cohesion, and deferred binding as candidate tactics, not automatic improvements.
- For every new abstraction, show a before/after scenario table. Reject a recommendation that merely moves edits or replaces file edits with registration, configuration, migration, or testing work.
- Require `cognitive-load-review` before accepting a recommendation that introduces a new abstraction, contract, pattern, layer, or process.
- If changeability improves while cognitive load worsens, report a trade-off. Do not merge the two into an unqualified "improved maintainability" verdict.

## Severity

- High: A supported change scenario can cause data loss, incompatible durable state/API behavior, unsafe deployment/rollback, or defects outside the intended responsibility.
- Medium: A supported or repeatedly observed scenario requires avoidable cross-owner propagation, broad verification, or coordinated migration that materially raises effort or regression risk.
- Low: The impact is localized, infrequent, or hypothetical, and the consequence of a missed co-change is limited.

Base severity on scenario evidence, impact, and frequency. Cognitive difficulty does not raise changeability severity; report it through the other skill.

## Reporting format

Lead with findings. For each finding include:

- Severity and tight location.
- Scenario and evidence strength: observed, planned, user-supplied, or hypothetical.
- Primary edit and propagated impact: concrete artifacts, contracts, consumers, tests, and delivery steps.
- Mechanism: why the primary edit spreads or risks side effects.
- Suggested direction: the smallest mechanism-focused change.
- Expected delta: before/after counts or an explicitly stated evidence gap.

When comparing a proposal, include:

| Measure for the same scenario | Before | After |
|---|---:|---:|
| Production artifacts edited | | |
| Propagated edits | | |
| Contracts/consumers affected | | |
| Verification/deployment steps | | |
| Migration/rollback actions | | |

Then add a separate cognitive-load result when applicable:

- Changeability verdict: Improved / Neutral / Worsened / Insufficient evidence.
- Cognitive-load verdict: quote the separate review; do not infer it here.
- Combined decision: Accept / Revise / Reject, with the explicit trade-off.

If there are no findings, state which scenarios were traced and identify any evidence or validation gap. Do not say that maintainability as a whole is satisfied.
