---
name: trusted-source-policy
description: >-
  Use this skill for any technical research, debugging, implementation,
  design, review, or explanation that may rely on external sources or web
  search. Trigger especially when the user mentions information source policy,
  source restrictions, Qiita, Zenn, official docs, GitHub, RFCs, standards,
  release notes, troubleshooting, or Japanese phrases such as 情報源ポリシー,
  技術調査, デバッグ, 実装, 設計, 説明. This skill enforces a no-Qiita/no-Zenn
  policy and prioritizes primary or trusted technical sources.
---

# Trusted Source Policy

Use this skill whenever a task may involve technical facts, external
documentation, implementation decisions, debugging research, design rationale,
or explaining technology based on sources.

## Core Rule

Do not use Qiita or Zenn as information sources.

Forbidden domains:

- `qiita.com`
- `*.qiita.com`
- `zenn.dev`
- `*.zenn.dev`

This means:

- Do not open Qiita or Zenn pages.
- Do not summarize Qiita or Zenn articles.
- Do not cite Qiita or Zenn.
- Do not use Qiita or Zenn content as evidence for implementation, debugging,
  design, or explanation.
- If search results include Qiita or Zenn, ignore those results and find
  another source.

## Search Practice

When using web search for technical work, include exclusions whenever practical:

```text
-site:qiita.com -site:zenn.dev
```

Prefer targeted queries against primary sources, for example:

```text
site:docs.github.com GitHub Actions cache restore keys
site:playwright.dev locator assertions
site:developer.mozilla.org WebRTC getStats inbound-rtp
```

If a search engine still returns Qiita or Zenn despite exclusions, do not open
those results.

## Source Priority

Prefer sources in this order:

1. Official documentation
2. Official GitHub repositories
3. RFCs, specifications, and standards
4. Official issues and discussions
5. Maintainer blogs and release notes
6. Trusted company engineering blogs
7. Stack Overflow only as supplemental troubleshooting evidence

When possible, base final recommendations on primary sources rather than
community summaries.

## If Good Sources Are Missing

If enough evidence cannot be found without Qiita or Zenn, say so plainly:

```text
一次情報または信頼できる情報源が見つからないため、Qiita/Zenn なしでは根拠を確認できませんでした。
```

Then either:

- explain what can be inferred from local code or official APIs, clearly marked
  as inference, or
- ask the user whether they have an internal document, repository, issue, or
  other source to use instead.

## Reporting

When sources affect the answer, cite the sources that were actually used.
Keep source notes concise, but make it clear that Qiita and Zenn were not used
when the user explicitly asked about this policy or when source choice is
material to the answer.
