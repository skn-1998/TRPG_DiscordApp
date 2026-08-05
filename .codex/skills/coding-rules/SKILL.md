---
name: coding-rules
description: Create, modify, review, or refactor code using explicit readability, cognitive-load, changeability, and repository-scale maintainability checks, and create, update, or review AI-oriented coding standards. Use whenever writing or changing code, reviewing a pull request or implementation, planning a refactor, generating AGENTS.md, Copilot instructions, CLAUDE.md, Cursor .mdc rules, repository coding rules, review checklists, or team standards covering code style, architecture boundaries, testing, security, dependencies, validation commands, and AI assistant behavior.
---

# Coding Rules

Use this skill to turn project context, team preferences, or uploaded reference material into clear coding standards that another AI coding assistant can consistently follow.

## Core workflow

1. Before writing, modifying, reviewing, or refactoring code, load `references/rule-catalog.md` and apply its readability, cognitive-load, changeability, and repository-scale maintainability checks to the affected code.
2. Identify the target artifact:
   - `AGENTS.md` for repository-wide AI agent instructions.
   - `.github/copilot-instructions.md` for GitHub Copilot repository instructions.
   - `.cursor/rules/*.mdc` for Cursor path-scoped or agent-requested rules.
   - `CLAUDE.md` for Claude Code memory-style instructions.
   - Review checklist or policy document for humans and CI.
3. Extract available project context:
   - language, runtime, framework, package manager, and target platform
   - repository layout, architecture boundaries, generated-code locations
   - formatter, linter, type checker, build, test, and CI commands
   - testing strategy, security requirements, dependency policy, logging/error conventions
4. If context is missing, make conservative defaults and label them as assumptions. Do not invent commands or project facts.
5. Separate rules into three levels:
   - **must**: correctness, security, compatibility, maintainability, or data protection rules
   - **should**: preferred defaults that can be overridden with a reason
   - **avoid**: risky patterns, deprecated APIs, broad rewrites, or actions needing approval
6. Keep always-loaded instructions short. Put rationale, examples, and long Good/Bad patterns into separate background files.
7. Include validation commands and expected evidence before accepting code.
8. After every implementation that changes code, configuration, schemas, or scripts, load
   `../cognitive-load-review/SKILL.md` and complete its mandatory post-implementation Mode A review
   against the complete working-tree diff before accepting the change or reporting it as complete.
   Passing tests does not replace this review. Then complete the remaining review passes:
   - local readability within the changed code, compared with the pre-change implementation
   - changeability of the affected behavior and likely future modifications
   - repository-scale maintainability and structural coherence beyond the changed files
   If the cognitive-load review leaves a High or Medium extraneous-load finding, fix it and rerun the
   review before acceptance, or report it explicitly when the user requested review only.
9. Finish with a concise checklist usable by an AI or human reviewer.

## Rule design principles

- Make every rule observable. Replace vague instructions like "write clean code" with checks tied to behavior, structure, or validation.
- Reduce cognitive load: prefer rules that let readers follow code without simultaneously remembering multiple conditions, states, variable meanings, or hidden effects. Load `references/rule-catalog.md` for observable checks.
- Treat passing tests and absence of bugs as necessary but insufficient. Compare before and after the change, and do not accept new variables, flags, states, branches, aliases, or intermediate abstractions that increase the concepts a reader must track without removing greater complexity or expressing a necessary domain concept.
- Do not optimize for the fewest variables. A well-named, narrowly scoped intermediate value may reduce cognitive load; reject it only when it duplicates state, obscures ownership, widens lifetime, creates synchronization obligations, or adds a concept without explanatory value.
- Review beyond the diff after implementation. Search the relevant repository scope for semantically equivalent functions, duplicate responsibilities, parallel abstractions, and existing owners or extension points before concluding that the change is maintainable.
- Do not require reuse merely because related code exists. Decide whether to reuse, extend, consolidate, or keep implementations separate based on responsibility, contract, dependency direction, and expected reasons to change; record the reason when the choice is non-obvious.
- Prefer existing codebase style over new conventions unless the user explicitly asks for a migration.
- Delegate mechanical formatting to the formatter/linter when present; reserve AI rules for non-obvious decisions.
- Include an AI-specific section that forbids placeholder comments such as `// ... existing code ...` and unsupported API invention.
- Require approval for new production dependencies, public API changes, auth/permission changes, migrations, billing, notifications, or destructive operations.
- Add a conflict rule: task-specific user instructions override standing rules only when they do not violate security or explicit project constraints.
- Use the Rule of Three: add a standing rule when the AI or team repeatedly makes the same mistake, not for every possible edge case.

## Default `AGENTS.md` structure

Use this structure unless the user provides a different template:

```markdown
# AGENTS.md

## 1. basic policy
- Follow existing patterns before introducing new architecture.
- Keep changes small and focused.
- Do not mix feature work, bug fixes, broad formatting, and refactoring.

## 2. ai-specific restrictions
- Do not use placeholder comments such as `// ... existing code ...`.
- Do not invent files, commands, APIs, environment variables, or packages.
- State assumptions when project facts are unknown.

## 3. setup and validation
- Install: [command]
- Format: [command]
- Lint: [command]
- Type check: [command]
- Test: [command]
- Build: [command]

## 4. coding rules
### Must
### Should
### Avoid

## 5. testing rules
## 6. security and dependency rules
## 7. pull request checklist
```

## Cursor `.mdc` guidance

Use concise `.mdc` files for active rules and separate background files for rationale.

- For repository-wide rules: use `alwaysApply: true` only for very short, universal constraints.
- For language/path-specific rules: use `alwaysApply: false` plus `globs`.
- For rare or task-triggered rules: use `description` and leave `globs` empty or narrow.
- Keep rule files compact; move explanations to `.cursor/rules_background/*.md`.

Example frontmatter:

```markdown
---
description: repository coding rules for ai assistants.
globs: ["src/**/*", "tests/**/*"]
alwaysApply: false
---
```

## Review output format

When reviewing code or a pull request against coding rules, use:

```markdown
## Verdict
[approved / approve with nits / changes requested / needs more context]

## Blocking issues
- [rule violated] [file/function] [why it matters] [suggested fix]

## Non-blocking improvements
- [suggestion] [reason]

## Cognitive-load delta
- New concepts to track: [variables, states, branches, aliases, or abstractions]
- Complexity removed or clarity gained: [evidence]
- Verdict: [reduced / unchanged / justified increase / unjustified increase]

## Repository-scale maintainability
- Duplicate capability or responsibility: [none found / finding with evidence]
- Existing owner or abstraction reuse: [reused / extended / intentionally separate, with reason]
- Boundaries and dependency direction: [preserved / finding]
- Future change locality: [expected change locations and whether they remain coherent]

## Validation
- Checks observed: [commands, tests, or evidence]
- Checks still needed: [commands or manual checks]

## Rule updates suggested
- [new or clarified rule]
```

## Reference material

Always load `references/rule-catalog.md` before writing, modifying, reviewing, or refactoring code. Also load it when the user needs a fuller rule set, background rationale, or category checklist. Use its repository-scale review section as the post-implementation structural review gate.

After implementation, always load `../cognitive-load-review/SKILL.md` and complete its mandatory
Mode A gate. This requirement is unconditional for code, configuration, schema, and script changes;
type checking and tests are complementary evidence, not substitutes.
