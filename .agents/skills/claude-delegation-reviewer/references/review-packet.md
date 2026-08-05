# Claude Handoff Template

```md
## Claude Handoff

目的:

モデル: Fable (`--model fable`)

参照:

使用する skill:

変更範囲:

触らない範囲:

注意:

検証:

返却してほしい証跡:

完了条件:
```

# Claude Review Packet

```md
## Review Result

Status:

Findings:

Evidence reviewed:

Model check:

Validation:

Scope check:

Architecture/design check:

Residual risk:

Next action:
```

# Review Checklist

- Objective matches the original handoff.
- The handoff and launch evidence explicitly select Fable (`--model fable`).
- Required documents were read or their relevant rules are reflected.
- Diff stays inside the allowed scope.
- Forbidden project patterns were not added.
- Tests or validation logs are present and relevant.
- Any failing validation is classified as related or unrelated.
- Documentation changed when design or migration policy changed.
- The returned evidence is enough for the user to audit the result.
