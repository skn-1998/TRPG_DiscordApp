---
name: code-comment-rules
description: >-
  Use when adding, reviewing, or refactoring code comments in the
  dokcer-trpg-remix-app project (TRPG-SERVER / trpg-remix-app). Trigger on
  requests about comment rules, missing comments, making code easier to
  understand, JSDoc/TSDoc, TODO/NOTE comments, explaining thresholds,
  documenting retries/timeouts, documenting project exceptions, or reviewing
  whether comments are useful and maintainable. This skill enforces local
  project comment culture and trusted source rules that forbid Qiita/Zenn as
  technical sources.
---

# Code Comment Rules

このSkillは、コメント不足でコード理解に時間がかかる状況を減らすための運用ルール。目的はコメント量を増やすことではなく、未来の読者が「なぜこの形なのか」「どの前提を壊してはいけないのか」を短時間で掴める状態にすること。

## 最初に読む正本

コメントを追加・レビューする前に、対象に応じて以下を読む。

- ルートの `CLAUDE.md`（プロジェクト方針）
- バックエンドを触る場合は `TRPG-SERVER/AI.md` と対象機能の `TRPG-SERVER/AI.*.md`
- module 境界に関わる場合は `TRPG-SERVER/src/ARCHITECTURE.md`
- discord 層を触る場合は `TRPG-SERVER/src/discord/DESIGN.md`
- 外部情報源を使う場合は `.claude/skills/trusted-source-policy/SKILL.md`

## 情報源ポリシー

- ローカルのコード・テスト・設計docを第一の情報源にする。
- 外部技術情報が必要な場合は、公式ドキュメント、公式GitHub、仕様書、標準、メンテナの文書を優先する。
- Qiita / Zenn は開かない、要約しない、引用しない、コメント根拠に使わない。ユーザーがURLを提示した場合も、公式情報・社内doc・ローカル実装から代替根拠を探す。
- コメントに外部URLを残すのは、そのURLが長期的に読者の判断に必要な場合だけにする。一般論の参考リンクはPR説明や設計docへ寄せる。
- TypeScript の公開APIコメント構文が必要な場合は TSDoc を参照する。コメント方針の一般原則は公式スタイルガイドを補助的に参照してよい。
- 許可する外部参照例: TSDoc (`https://tsdoc.org/`)、Google Style Guides (`https://google.github.io/styleguide/`)。

## コメントするもの

コメントは次のどれかを満たすときに書く。

- **Why**: なぜこの実装・閾値・順序・待機・制約が必要か。
- **Invariant**: 壊してはいけない前提、順序、所有権、互換性。
- **Boundary**: domains / discord / events / projection などの責務境界。
- **Exception**: 規約から外れる理由、必要悪、暫定対応の終了条件。
- **External contract**: Discord API、MongoDB、環境変数、設定ファイルとの契約。
- **Test intent**: spec が何を検証し、何を前提に skip するか。

書かないもの。

- 命名・型・直後のコードを読めば分かる what コメント。
- 実装と同期しにくい長い背景説明。
- 現在のPR番号・一時チケット番号・作業者名。
- `// existing code...` のようなプレースホルダー。
- 根拠を確認していない推測のコメント。

## 標準パターン

### ファイル冒頭 JSDoc

spec や複雑な service には、冒頭で目的と前提を短く書く。

```ts
/**
 * ダイスロール結果が hub チャンネルへ投稿されることを検証する。
 * 429 応答時に retry timer で再試行し、上限到達で打ち切ることを検証する。
 *
 * 必要な前提: DiscordFacadeService モックが返す channelId と guild 設定。
 */
```

### Arrange / Act / Assert 区切り

spec 本文は既存規約に合わせ、読み手が流れを追える粒度で区切る。

```ts
// --- 先にキャラクターを保存し、編集開始時点で対象が存在する状態にする ---
await characterService.create(createDto);
```

区切りコメントは「何をするか」だけでなく、可能なら順序の理由も入れる。

### NOTE

規約逸脱や必要悪は `NOTE` で理由を残す。

```ts
// NOTE: 規約例外 - Discord API の rate limit (429) は retry-after 秒待つこと自体が仕様。
await this.scheduleRetry(retryAfterMs);
```

規約参照がある場合は `// NOTE: 規約例外 - {理由}` の形を優先する。

### TODO

TODO は放置メモではなく、暫定状態の契約として書く。

```ts
// TODO: sheet-projection 統合完了後にこの直接投稿経路を削除する - 現状は旧 UI との互換性が必要。
```

TODO には「なぜ暫定か」「どうなったら消せるか」を入れる。現在のPR番号だけを残すTODOは禁止。永続的な課題管理リンクを入れる場合は、プロジェクトで追跡可能で、コード読者に必要なときだけにする。

### TSDoc / JSDoc

export される関数・型・クラスのうち、呼び出し契約が名前だけで分からないものに書く。

```ts
/**
 * characterId からアクティブなキャラクターシートを解決する。
 *
 * 編集セッション中の下書きがあればそれを優先する。
 * 確定済みシートだけが必要な場合はこの関数を使わない。
 */
```

全 private 関数に機械的にJSDocを書く必要はない。公開面、複雑な precondition、戻り値の意味、失敗時の挙動が非自明な場所を優先する。

## 後付けコメントの進め方

既存コードへコメントを足すときは、広範囲に一括で足さず、理解コストの高い順に小さく進める。

1. 対象ファイルの近傍コード、テスト、関連doc（`AI.*.md`）を読む。
2. コメント候補を「Why / Invariant / Boundary / Exception / External contract / Test intent」に分類する。
3. 自明な what コメントを除外する。
4. コードに近い場所へ、短いコメントを追加する。
5. コメントが実装と矛盾していないかを見直す。
6. 可能なら関連する型チェック・単体テスト・対象specを実行する。

優先度が高い場所。

- ダイス計算の判定境界（クリティカル/ファンブル・成功度）と丸め
- Discord API の rate limit / retry backoff / timer 再試行・上限
- customId の契約と InteractionRegistry のルーティング
- events/ の発行・購読の因果関係、冪等性、イベント RPC 禁止の境界
- projection / materialized の更新経路と旧経路の抑止
- スレッド・チャンネルの保存キーの意味論（channelId / threadId の使い分け）
- 暗号化トークンの保存・復号、env/config の解決
- domains と discord 層の責務境界が誤読されやすい箇所
- export され、他 module から呼ばれる公開 API

## レビュー時の見方

コメントレビューでは、量ではなく読者への効果を見る。

- 閾値・数値・retry・timeout に理由があるか。
- 必要悪に `NOTE` があり、規約上の例外として説明されているか。
- spec 冒頭に検証目的と必要前提があるか。
- コメントが古く、実装と矛盾していないか。
- what コメントでノイズを増やしていないか。
- コメントの言語が1ブロック内で統一されているか。

指摘は次の形で書く。

```markdown
⚠ コメント不足 - retry 上限 5 回の根拠コメントがありません
file: src/discord/services/channel/message-manager.service.ts:42
detail: この値が Discord API の制約・実測・恣意のどれに基づくか分からず、将来変更時に判断できません。
suggestion: 上限の由来、または関連する障害事例・公式ドキュメントを短くコメントしてください。
```

## 変更後の確認

- コメントだけの変更でも、近傍の構文を壊していないか確認する。
- TypeScript を触った場合は、対象パッケージに応じて確認コマンドを選ぶ（TRPG-SERVER なら `pnpm run build` / `pnpm run lint:check` と関連する `pnpm run test`）。
- spec の意味・skip 条件・モック戦略に触れた場合は、該当specまたは最小の関連テストを実行する。
- 実行できない場合は、理由と未確認リスクを最終報告に残す。
