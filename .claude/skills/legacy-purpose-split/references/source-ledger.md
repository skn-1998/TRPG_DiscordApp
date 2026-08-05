# Source Ledger

Sources are listed in precedence order for this Skill. No Qiita or Zenn source is used.

## MinoDriven Primary Sources

### M1. AI Refactoring Approach

- URL: https://speakerdeck.com/minodriven/ai-refactoring-approach
- Relevant slides: 31-43, especially 32 and 38-43.
- Adopted: understand purpose before structural change; improve AI inference with design documents and other evidence; use purpose-based class separation; commonize logic only when it serves the same purpose; tests are important evidence for safe refactoring.
- Limit: the presentation's concrete copy/delete, IDE, and testing examples are techniques for performing a refactor. This Skill stops at analysis and does not make those techniques mandatory runtime steps.

### M2. Ghosts of Technical Debt

- URL: https://speakerdeck.com/minodriven/ghosts-of-technical-debt
- Relevant slides: 24-28.
- Adopted: a means should be organized around one purpose, and changeability is a design objective; purpose-based models help avoid mixed responsibilities.
- Limit: the source does not define a universal legacy migration checklist or completion gate.

### M3. Invisible-Driven Design

- URL: https://speakerdeck.com/minodriven/invisible-driven-design
- Relevant slides: 12-35 and 47-51, especially 21-26, 31-35, and 47-51.
- Adopted: physical-model units can grow while serving different purposes; purpose cannot be established from appearance alone; actors and domain experts provide evidence for purpose-specific interpretation; split models by purpose.
- Limit: examples illustrate modeling decisions and do not prove the purpose of a new target.

## Complementary Primary Sources

### F1. Martin Fowler, Refactoring

- URL: https://refactoring.com/
- Adopted: refactoring restructures software while preserving observable behavior; small transformations and verification support safe execution.
- Limit: this Skill classifies the observable-behavior boundary but does not execute transformations or verification.

### F2. Martin Fowler, Strangler Fig Application

- URL: https://martinfowler.com/bliki/StranglerFigApplication.html
- Adopted: gradual replacement can be considered when an existing routing or use-case seam supports it.
- Limit: this is one migration option, not a default or required sequence; it does not establish purpose boundaries.

### O1. OpenAI Skills, Skill Creator

- URL: https://github.com/openai/skills/blob/main/skills/.system/skill-creator/SKILL.md
- Adopted: concise SKILL.md, progressive disclosure, explicit trigger metadata, realistic forward evaluation, and references for detailed material.
- Limit: it defines Skill construction, not legacy-design truth.

## Unofficial Comparator

### C1. inspired-mino-design-skills

- URL: https://github.com/my-take-dev/inspired-mino-design-skills/tree/afd50e2ca18bb22e336a05df1c8481dbcd652b5c
- Role: structure and coverage comparator only.
- Limit: it is not a MinoDriven primary source. Its characterization-test, ownership, rollback, branch, release, and temporary-path rules are not attributed to MinoDriven and are not adopted as universal requirements here.
- Vocabulary note: this Skill's `must-preserve`, `intentional-change`, and `unknown` behavior classes overlap comparator terminology, but are derived here from Fowler's observable-behavior definition and the installed parent's preserving/change scope. The comparator's characterization-test workflow is not adopted.

## Local Operational Decisions

- Keep this child diagnostic and analysis-only so it remains directly callable and independently testable.
- Preserve the common Actor/Purpose/Context/Constraints/Evidence input used by sibling Skills.
- Use explicit `analysis-supported` and `analysis-incomplete` outcomes instead of pretending that analysis proves implementation safety.
- Keep downstream Skills opaque and hand off only the artifact required next.
