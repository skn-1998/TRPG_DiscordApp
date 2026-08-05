---
name: codex-delegate
description: >-
  【redirect stub - 正本は codex-delegate-e2e】Codex CLI（codex exec）への実装・修正・レビューの
  移譲手順はすべて .claude/skills/codex-delegate-e2e/SKILL.md が正本。「Codex に実装させて」
  「Codex にレビューさせて」「修正ラウンドを回して」等の依頼は codex-delegate-e2e を参照すること。
  本スキルは手順を持たない。
---

# codex-delegate から codex-delegate-e2e への redirect

正本: `.claude/skills/codex-delegate-e2e/SKILL.md`
（実行契約、`.claude/skills/codex-delegate-e2e/scripts/codex_run.sh`、
`.claude/skills/codex-delegate-e2e/scripts/codex_doctor.sh`、レビューループ、
独立検収のすべては正本側に集約する）。

- 本ディレクトリに `scripts/` は置かない。
- 手順や例外は正本だけに追記し、二重管理しない。
