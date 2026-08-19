# シートテンプレート複製（fork）の設計

- 作成: 2026-08-18
- 依頼: 「シートテンプレートにコピーするボタンを作成してほしい」→ 確認により **既存テンプレート → 自分のテンプレートへ複製** と確定
- 実行 Skill 経路: `route-design-work`（Route and orchestrate）
  → `frame-purpose-goal-means` → `interpret-design-context` → `analyze-data-destruction`
  → `model-domain-invariants` → `name-by-purpose`
- 本 doc は**設計成果物であり実装ではない**。実装は fable-rules 経由で Opus/Codex へ委譲する
- 基準 commit: `404a8946`（develop・作業ツリーに未コミット変更あり）

---

## Design Route

Result: **Partial**
Mode: Route and orchestrate

`Partial` の理由（**2026-08-18 更新**）: Q-1〜Q-5 は全件裁定済みで手段は M-2 に確定したが、
**DQ-1（`validateForSave` 通過保証）・DQ-2（body サイズ）・DQ-3（`license` 継承規則）が未確認**のため、
`analyze-data-destruction` の「未確認事項がない」条件を満たさない。実装前に DQ-1 の実測（T-9）が必要。
（裁定前の `Partial` 理由は「Q-1〜Q-5 が未解決」だった。裁定により理由が入れ替わっている）
`frame-purpose-goal-means` / `analyze-data-destruction` / `model-domain-invariants` が
それぞれ `Partial` で返っており、専門 Skill の `Partial` を `Complete` へ読み替えない規則に従う。

### Evidence and Inherited Policies

| ID | Type | Source and locator or rule | Verification status | Passed to |
|---|---|---|---|---|
| POL-1 | source-policy | Qiita / Zenn を技術的根拠にしない（`trusted-source-policy`） | 適用済み（本設計は全て一次＝リポジトリ実コード） | S1〜S5 |
| POL-2 | change-scope | 本 Skill 実行ではコードを変更しない（`name-by-purpose` 不変条件・`route-design-work` の設計専念） | 遵守（新規 doc 1 本のみ） | S1〜S5 |
| POL-3 | approval | 実装着手は fable-rules ゲート（Fable は書かず Opus/Codex へ委譲・code-comment-rules 必須・認知負荷レビュー必須） | 未着手 | 実装フェーズ |
| POL-4 | change-scope | 台帳 §2-2「規約・コメント頼み（破っても全緑）」の不変条件は委譲プロンプトへ転記する | 本 doc §S4 が転記元 | 実装フェーズ |
| POL-5 | change-scope | 台帳 §1-5「シートのコピー / フォーク」は **v1.1 延期（ユーザー明示）**。本設計は**テンプレート**の複製であり、当該延期裁定を覆さない | 明示（§S2 BS-1） | S2・実装フェーズ |

### Request Coverage

| Request ID | Requested outcome | Artifact ID | Selected Skill | Selection rationale | Actual result | Completion / stop condition |
|---|---|---|---|---|---|---|
| R-1 | 複製ボタンが解く目的と、複製以外の手段の妥当性 | A-1 目的・目標・手段の追跡表 | `frame-purpose-goal-means` | 「複製」は手段。目的（配布テンプレを土台に自分用へ改変）が確定しないと手段の採否を判定できない | Partial | 各目的が観測可能な目標へ接続 / 目的が推論のみなら Partial |
| R-2 | 「コピー」「複製」「fork」「移行」の語義衝突の解消 | A-2 候補解釈と衝突表 | `interpret-design-context` | 既存 UI に「v3 draft として作成」（移行）があり、モデルに `forkedFrom` がある。語を決めないと二重語彙が生まれる | Partial | 重要語ごとに Confirmed 1 件 / 未解決なら Partial |
| R-3 | 複製操作で壊れうるデータ・状態の洗い出し | A-3 破壊シナリオと制約候補 | `analyze-data-destruction` | 複製は「読み取り境界」「所有権」「公開設定」を跨ぐ生成操作。制約候補を先に出さないと不変条件を書けない | Partial | 全シナリオを Prevent/Detect/Allow へ分類 / 未確認が残れば Partial |
| R-4 | 複製操作の契約（何を継承し何を新規化するか） | A-4 操作契約と不変条件 | `model-domain-invariants` | 実装委譲プロンプトへ転記する不変条件の正本がここから出る | Partial | 対象操作の pre/post/failure/invariant を全評価 / 未確認が残れば Partial |
| R-5 | ボタン文言・action 名・API 名 | A-5 命名判断 | `name-by-purpose` | 既存 `forkedFrom` と新語を作ると語彙が二重化する（台帳 §2-2 の drift 源） | Complete | 採用名が 1 目的 1 文脈へ追跡可能 |

### Route

| Order | R/A IDs | Skill | Single purpose | Verified inputs | Inherited policies | Completion gate | Stop condition | Human approval |
|---|---|---|---|---|---|---|---|---|
| S1 | R-1 / A-1 | `frame-purpose-goal-means` | 目的・目標・手段の分離と手段の目的化検査 | E-1〜E-11 | POL-1, POL-5 | 破壊質問 4 問を通過 | 目的が推論のみ | 目的の確定はユーザー |
| S2 | R-2 / A-2 | `interpret-design-context` | 語の候補意味と衝突の特定 | S1 の P-*/G-*、E-2, E-7, E-10 | POL-1, POL-5 | 重要語 4 語に候補解釈 | 用例 0 件 | 語の採択は S5 で提示 |
| S3 | R-3 / A-3 | `analyze-data-destruction` | 破壊経路から制約候補を発見 | S1 の G-*、S2 の I-*、E-4〜E-9 | POL-1, POL-2 | 全 DS を分類 | 実データ変更要求 | Allow 判定はユーザー |
| S4 | R-4 / A-4 | `model-domain-invariants` | 確認済みルールの契約化 | S3 の CN-*、S1 の G-* | POL-1, POL-4 | 全条件に強制点を割当 | 制約未発見 → S3 差し戻し | 契約の承認はユーザー |
| S5 | R-5 / A-5 | `name-by-purpose` | 目的特化名の提案（実行しない） | S1 の P-*、S2 の I-*、E-7 | POL-1, POL-2 | 採用名が既存語彙と非衝突 | 対象が多目的 | 採用はユーザー |

### Handoffs

| From | Result | Artifact and locator | To | Verified receiving precondition | Unresolved |
|---|---|---|---|---|---|
| S1 | Partial | A-1（本 doc §S1） | S2 | 解釈対象と用例を特定できる（E-1, E-10 実在） | P-2/P-3 が推論 |
| S2 | Partial | A-2（§S2） | S3 | アクター目的と主要更新経路を確認できる（I-1 Confirmed・更新経路 = create） | I-4 の採否未決 |
| S3 | Partial | A-3（§S3） | S4 | 制約候補 CN-1〜CN-8 が存在 | DS-8/DS-13 が Unknown |
| S4 | Partial | A-4（§S4） | S5 | 目的・文脈・共有言語が確定（OP-1 の単一目的） | Q-1 の実装形が未決 |
| S5 | Complete | A-5（§S5） | 実装フェーズ | — | 採用はユーザー承認待ち |

### Excluded Skills

| Skill | Why not selected |
|---|---|
| `model-invisible-concepts` | 可視名詞 template の背後の「由来」概念は **既に `forkedFrom` として可視化済み**（entity.ts:5-8）。別アクター目的が混在している兆候なし。発見対象が無い |
| `discover-bounded-contexts` | 既存 `character-sheet-template` コンテキスト内の 1 ユースケース追加。新境界の兆候なし |
| `develop-ubiquitous-language` | 用語契約の整備ではなく 1 語（fork/copy）の採択。`name-by-purpose` で足りる |
| `prioritize-quality-attributes` | 競合する品質属性がない。応答サイズは台帳 H-18 で既定済み |
| `encapsulate-by-purpose` / `abstract-by-purpose` / `reduce-interface-branching` | 再配置・抽象化・分岐除去の対象がまだ存在しない（新規ユースケース）。実装後の認知負荷レビューで扱う |
| `analyze-data-destruction` 以外の発見系 | 同上 |
| `prioritize-design-debt` / `split-legacy-by-purpose` / `plan-ai-assisted-refactoring` | 負債整理でもリファクタでもない |
| `facilitate-design-learning` / `scale-design-knowledge` | 知識配布の依頼ではない |

### Execution Record

| Skill | Result | Evidence / artifact IDs | Accepted for next step? | Stop / restart point |
|---|---|---|---|---|
| S1 `frame-purpose-goal-means` | Partial | E-1〜E-11 / A-1 | Yes（G-1〜G-6 は確認済み根拠を持つ） | P-2/P-3 の確認はユーザー |
| S2 `interpret-design-context` | Partial | I-1〜I-9 / A-2 | Yes（I-1 Confirmed） | I-4 は Q-1 と連動 |
| S3 `analyze-data-destruction` | Partial | DS-1〜DS-13, CN-1〜CN-8 / A-3 | Yes | DS-8/DS-13 の実測 |
| S4 `model-domain-invariants` | Partial | OP-1, C-1〜C-9 / A-4 | Yes | Q-1 決定後に強制点が確定 |
| S5 `name-by-purpose` | Complete | SY-1〜SY-4, CD-1〜CD-9 / A-5 | Yes | 採用承認 |

### Result Decision

| Postcondition ID | Applicable mode | Pass/Fail/N/A | Evidence | Result impact |
|---|---|---|---|---|
| PC-COMMON-1 | 両方 | Pass | 各 Skill が異なる 1 目的（目的整理／語義／破壊／契約／命名） | — |
| PC-COMMON-2 | 両方 | Pass | Handoffs 表の receiving precondition が全て確認済み | — |
| PC-COMMON-3 | 両方 | Pass | Excluded Skills に除外理由を記録 | — |
| PC-COMMON-4 | 両方 | Pass | R-1〜R-5 を A-1〜A-5 へ全割当 | — |
| PC-ROUTE-1 | Route only | N/A | orchestrate モードのため | — |
| PC-EXEC-1 | orchestrate | Pass | 各 Skill の実結果を確認・Blocked 後の推測続行なし | — |
| PC-EXEC-2 | orchestrate | Pass | 全成果物を専門 Skill 結果へ追跡可能 | — |
| （Complete 判定） | orchestrate | **Fail** | S1/S2/S3/S4 が Partial | **Router 結果 = Partial** |

---

## S1. Framing（目的・目標・手段）

Result: **Partial**
Result evidence IDs: E-1, E-2, E-4, E-5, E-6, E-7, E-9, E-11

### Evidence Ledger

| ID | Type | Author / source | Locator | Content | Confidence | Human-confirmed |
|---|---|---|---|---|---|---|
| E-1 | decision | ユーザー | 会話 2026-08-18 | 「シートテンプレートにコピーするボタン」＝**既存テンプレ → 自分のテンプレへ複製**。実行モード = Route and orchestrate | High | **Yes** |
| E-2 | code | — | `trpg-next-app/app/features/characterTemplate/components/TemplateListV3.tsx:152-160` | `!isSystemTemplate` のときだけ「編集」ボタンを描画。**配布テンプレは編集導線なし** | High | No |
| E-3 | code | — | 同 `:171-186` | 削除ボタンも `!isSystemTemplate` 条件 | High | No |
| E-4 | code | — | `TRPG-SERVER/src/domains/character-sheet-template/character-sheet-template.service.ts:66-70, 226-230` | `findOne` は `assertOwner`。**非所有者は全体（sections/tables）を取得できず 403** | High | No |
| E-5 | code | — | 同 `:216-224` | `assertRevisionReadableBy` は `SYSTEM_TEMPLATE_AUTHOR` 所有を読み取り特例で許可。コメント「mutation は所有者限定のまま変更しない」 | High | No |
| E-6 | code | — | `repositories/character-sheet-template.repository.ts:34-47` | 一覧は「自分の全部」∪「system 所有かつ published」。**他ユーザーの public/unlisted は一覧に出ない** | High | No |
| E-7 | code+observation | — | `models/character-sheet-template.entity.ts:5-8, 35, 57` ＋ 全リポ grep | `forkedFrom { templateId, version }` が entity / DTO / model / repository select / summary 投影に配線済み。**production の書き込み元は 0 件**（front `CreateSheetTemplateRequest.forkedFrom` も型のみで未使用） | High | No |
| E-8 | decision | ユーザー（過去） | `document/character-sheet-proposals/design-ledger.md` §1-5 | 「**シート**のコピー / フォーク」は v1.1 延期・今回スコープ外 | High | Yes（過去） |
| E-9 | code | — | `character-sheet-template.service.ts:39-55` | `create` は `templateId: uuidv4()` / `status: 'draft'` / `draftRevision: 1` / `authorDiscordUserId` = 要求者を強制。ただし `visibility: dto.visibility ?? 'private'` は**呼び出し側指定を受ける** | High | No |
| E-10 | code | — | `app/features/characterTemplate/actions.ts:63-84` | `importV2Template(payload)` = payload から `createSheetTemplate` → 編集画面へ redirect。**複製と同形の既存経路** | High | No |
| E-11 | code | — | `api/sheetTemplateApi.server.ts:22-33` | `getSheetTemplateRevision(templateId, version)` が front に実在（`GET /:id/revisions/:version`） | High | No |
| E-12 | code | — | `character-sheet-template.service.ts:109-119` | `status !== 'draft'` の構造更新は `ConflictException('published/deprecated template structure is immutable')` | High | No |
| E-13 | code | — | `dto/create-character-sheet-template.dto.ts:4-12` | `SheetTemplateForkedFromDto` は `templateId`/`version` の非空文字列検査のみ。**存在検査なし** | High | No |

### Purpose Map

| Purpose ID | Actor | Purpose | Parent | Evidence | Status |
|---|---|---|---|---|---|
| P-1 | テンプレート利用者（GM・PL） | 配布テンプレートを土台に、自分用に改変した版を持ちたい | — | E-1, E-2, E-5, E-6 | **Confirmed**（E-1 の直接回答 ＋ E-2 の導線欠落が裏付け） |
| P-2 | テンプレート作者 | 自分の既存テンプレートから派生版を作り、元を壊さず実験したい | — | E-1, E-12 | **Inferred**（仮説。E-1 は「既存テンプレ」としか言っておらず、自分所有を含むか未確認） |
| P-3 | 運用・将来の自分 | 派生の出所を辿れるようにしたい | P-1 | E-7 | **Inferred**（`forkedFrom` の存在は設計意図の痕跡だが、ユーザーが今それを望むかは未確認） |

### Goal Contract

| Goal ID | Purpose | Type | Observable condition | Evidence | Affected actors | Conflict |
|---|---|---|---|---|---|---|
| G-1 | P-1 | acceptance | 配布テンプレートのカードから 1 操作で、要求者所有の draft が 1 件生成され、その draft を `/templates/{id}/edit` で開ける | E-2, E-9, E-10 | 利用者 | — |
| G-2 | P-1 | goal | 生成 draft の `sections`/`tables`/`settings` が複製元と構造的に等価 | E-9 | 利用者 | — |
| G-3 | P-1, P-2 | constraint | 複製操作は複製元を一切変更しない（`draftRevision`/`status`/`publishedAt`/`updatedAt` 不変） | E-12 | 配布元・他利用者 | — |
| G-4 | P-1 | constraint | 生成物は `status='draft'` かつ `authorDiscordUserId` = 要求者 | E-9 | 利用者 | — |
| G-5 | P-3 | goal | 由来が `forkedFrom { templateId, version }` に記録される | E-7 | 運用 | P-3 が Inferred のため G-5 も暫定 |
| G-6 | P-1 | constraint | 複製経路が**現行の読み取り境界を広げない**（他人の private/draft テンプレの中身へ到達しない） | E-4, E-5, E-6 | 全テンプレート作者 | — |

### Means

| Means ID | Purpose | Goal | Purpose-specific role | Candidate means | Expected contribution | Evidence | Risk |
|---|---|---|---|---|---|---|---|
| M-1 | P-1 | G-1〜G-6 | **front 合成型**: 既存 2 面（配布 = `GET /:id/revisions/:version`、自分 = `GET /:id`）で読み、`POST /sheet-templates` で作る | server 変更ゼロ | 最短。E-10 の実績パターンと同形 | E-4, E-5, E-10, E-11 | **G-4/G-6 の強制点が front にしかない**。`visibility` を載せれば C-6 が破れる（E-9）。読み取り 2 面の分岐が front に露出 |
| M-2 | P-1 | G-1〜G-6 | **server 専用操作型**: `POST /sheet-templates/:id/fork` を新設し、読み取り規則と継承規則を server 内で 1 本化 | 不変条件をドメイン側で強制 | front は 1 呼び出し・分岐 0 | E-4, E-5, E-9 | 新 route / DTO / spec のコスト |
| M-3 | P-1 | G-1 | **権限緩和型**: 配布テンプレートを直接編集可能にする（複製しない） | — | — | E-5, E-12 | **却下推奨**。共有物の破壊。`published` 構造不変契約（E-12）と `assertRevisionReadableBy` のコメント「mutation は所有者限定のまま変更しない」（E-5）に正面衝突 |
| M-4 | P-3 | G-5 | 複製時に `forkedFrom` を書く | 既存フィールドの初の producer | 死蔵フィールドの解消 | E-7, E-13 | 存在検査がないため dangling 参照を作れる（→ DS-9） |

### Issue Ledger

| Issue ID | Type | Affected | Evidence | Description | Question / recovery | Status |
|---|---|---|---|---|---|---|
| IS-1 | gap | P-2 | E-1 | 「既存テンプレ」に**自分所有のテンプレート**を含むか未確認。含むなら読み取り面が 2 つ必要（E-4/E-5） | → Q-1 の前提 | Open |
| IS-2 | assumption | P-3, G-5 | E-7 | `forkedFrom` を書くことをユーザーが望むかは未確認。書かないなら本フィールドは死蔵のまま | → Q-3 | Open |
| IS-3 | contradiction | G-2 | E-9 | `create` は `validateForSave` を通る。**複製元が published（`validateForPublish` 通過済み）でも `validateForSave` を通る保証は未実測** | 実測: 配布テンプレ `legacy-coc` を create 経路へ流して 400 が出ないか | Open |
| IS-4 | assumption | G-1 | E-8 | 台帳 §1-5 の「シートのコピー/フォーク」延期と混同されうる。**別物である旨を台帳へ明記しないと、後続ループが裁定を覆したと誤読する** | → Q-5 | Open |

### Contract Checks

| Check ID | Type | Check | Pass/Fail | Evidence | Issues |
|---|---|---|---|---|---|
| CK-1 | Postcondition | 各目的が 1 件以上の目標へ接続 | Pass | P-1→G-1..4,6 / P-2→G-3 / P-3→G-5 | — |
| CK-2 | Postcondition | 各目標が 1 目的と 1 件以上の手段へ接続 | Pass | Means 表 | — |
| CK-3 | Postcondition | 各手段の役割が 1 目的に限定 | Pass | M-1/M-2 は P-1、M-4 は P-3 | — |
| CK-4 | Postcondition | 自己目的化した手段の明示 | Pass | M-4（`forkedFrom` が存在するから書く、は手段の目的化になりうる → IS-2 で仮説として明示） | IS-2 |
| CK-5 | Invariant | 人間の目的を AI が確定しない | Pass | P-2/P-3 を Inferred として表示 | IS-1, IS-2 |
| CK-6 | 破壊質問 a | この手段を使わずに目的は達成できるか | **Pass（重要）** | M-3 で達成可能だが E-5/E-12 に衝突 → 複製が正当 | — |
| CK-7 | 破壊質問 b | 目標を満たしても目的が達成されない反例 | **Fail** | G-2 を満たしても IS-3（`validateForSave` 不通過）なら G-1 が成立しない | IS-3 |
| CK-8 | 破壊質問 c | 目標が別アクターへ害を与えないか | Unknown | 配布元の `license`（entity:36）が未運用 → DS-13 | Q-3 |
| CK-9 | 破壊質問 d | 手段の採用自体が目的化していないか | Pass | M-4 を IS-2 として分離 | IS-2 |

**Result = Partial の根拠**: P-2/P-3 が推論のみ（CK-5）、CK-7 が Fail（IS-3 未実測）。最終推奨は行わない。

---

## S2. Context Interpretation（語義）

Result: **Partial**
Result evidence IDs: E-1, E-7, E-8, E-10

### Interpretations

| ID | Term | Utterance source | Affected actors | Candidate meaning | Purpose | Situational context | Rules | Evidence | Confidence | Status | Affected decisions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| I-1 | 「コピー」 | ユーザー | 利用者 | **既存テンプレートから、要求者所有の新テンプレート（draft）を生成する** | P-1 | `/templates` 一覧 | 生成物は必ず draft・要求者所有（E-9） | E-1, E-9 | High | **Confirmed** | 全体 |
| I-2 | 「コピー」 | ユーザー | 利用者 | テンプレート定義を JSON でクリップボードへ | 共有・退避 | 一覧 or エディタ | — | E-1（反証） | High | **Rejected**（E-1 の直接回答で否定） | ボタン文言（→ CD-2） |
| I-3 | 「コピー」 | ユーザー | 利用者 | 外部データの取り込み（import / 移行） | 旧データ救済 | 一覧下部の V2 移行カード | localStorage 由来のみ | E-10 | High | **Rejected**（入力源が外部でない） | 文言衝突（→ CD-3） |
| I-4 | 「コピー」 | モデル | 運用 | **fork = 由来 (`forkedFrom`) を保持した複製** | P-3 | ドメインモデル | `forkedFrom {templateId, version}` | E-7 | Medium | **Inferred** | Q-3・命名（CD-5） |
| I-5 | 「シートテンプレート」 | ユーザー | 利用者 | **画面名**（`/templates` の `Title` が「シートテンプレート」） | — | 一覧画面 | — | `TemplateListV3.tsx` Title | High | **Confirmed** | 「〜にコピー」の宛先＝この一覧 |
| I-6 | 「シートテンプレート」 | ドメイン | 開発 | `CharacterSheetTemplate` エンティティ | — | server | — | E-9 | High | Confirmed | — |
| I-7 | 「自分のテンプレート」 | ユーザー | 利用者 | `authorDiscordUserId === 要求者` | P-1 | 一覧 | mutation は所有者限定（E-5） | E-5, E-6 | High | **Confirmed** | C-1 |
| I-8 | 「配布」 | UI バッジ | 利用者 | `authorDiscordUserId === 'system'` かつ `published` | — | 一覧カード | 読み取りのみ特例（E-5, E-6） | E-5, E-6 | High | **Confirmed** | C-5 |
| I-9 | 「既存テンプレート」 | ユーザー | 利用者 | 配布テンプレのみ / 自分のも含む | P-1, P-2 | 一覧 | — | E-1 | Low | **Unknown** | Q-1（読み取り面が 1 面か 2 面か） |

### Competing Meanings

| IDs | Conflict | Counterexample | Evidence | Resolution needed |
|---|---|---|---|---|
| I-1 vs I-4 | 「コピー」は由来を捨て、「fork」は由来を残す。どちらを実装するかで `forkedFrom` の運命が決まる | 由来を書かないなら、`forkedFrom` は entity・DTO・repository select・summary 投影まで配線されたまま**永久に死蔵**（E-7） | E-7 | **Q-3**（ユーザー裁定） |
| I-1 vs I-3 | 生成結果が同一（自分の draft ＋ 編集画面へ redirect）なのに、既存 UI 文言は「v3 draft として作成」 | 複製ボタンも「draft として作成」と名付けると、利用者は 2 つの導線を区別できない | E-10 | **CD-3**（文言で分離） |
| I-9 | 「既存」の母集団が配布のみか自分のも含むか | 自分の draft を複製元にするなら `GET /:id`（E-4）が要り、配布なら `GET /:id/revisions/:version`（E-5）が要る。**読み取り面が違う** | E-4, E-5 | **Q-1** |

### Boundary Signals

| IDs | Term | Contexts with incompatible meanings | Evidence | Handoff |
|---|---|---|---|---|
| **BS-1** | 「コピー / フォーク」 | (a) **本設計**＝ CharacterSheetTemplate の複製。(b) **台帳 §1-5** ＝ CharacterSheet（キャラクターシート）の複製で **v1.1 延期・ユーザー明示のスコープ外** | E-8 | **境界確定は行わない**（`discover-bounded-contexts` 相当の作業は不要 ＝ 別エンティティであることが型で自明）。ただし **台帳へ「別物」と明記する**（Q-5）。実装委譲プロンプトにも転記し、委譲先が §1-5 を根拠に停止しないようにする |

### Assumptions

| ID | Interpretations | Assumption | Evidence | Affected decision | Status |
|---|---|---|---|---|---|
| AS-1 | I-8 | 配布テンプレートは常に `published`（一覧クエリが `status:'published'` で絞る） | E-6 | 配布テンプレの読み取りに `GET /:id/revisions/:version` が使える（`published` 許可・E-5） | **Confirmed**（E-6 のクエリ） |
| AS-2 | I-8 | 一覧 summary の `version` が、そのまま revision 読み取りの `version` として通る | E-6（summary に `version` 含む）, E-5（`template.version !== version` で 409） | M-1 の実装可否 | **Inferred**（単一バージョン保持前提のコメントが service.ts:207-208 にある） |

### Questions（設計判断への影響が大きい順）

| ID | Related | Question | Evidence gap | Affected decision | Priority |
|---|---|---|---|---|---|
| Q-1 | I-9, IS-1 | 複製元は**配布テンプレートのみ**か、**自分のテンプレートも**含むか | E-1 が「既存テンプレ」としか言っていない | 読み取り面 1 面 or 2 面 → M-1/M-2 の選択 | **最高** |
| Q-3 | I-4, IS-2 | 複製時に `forkedFrom` を記録するか | ユーザーの意向未確認 | 死蔵フィールドの解消 or 放置 | 高 |
| Q-5 | BS-1, IS-4 | 台帳 §1-5 に「テンプレート複製は別物」と追記するか | — | 後続ループの誤停止防止 | 中 |

---

## S3. Destruction Analysis（破壊分析）

Result: **Partial**
Analysis outcome: **Scenarios found**

分析は**思考実験のみ**。実データ・本番環境へは一切触れていない（本番 DB のテンプレート件数は台帳 §0 の 2026-07-30 実測で 0 件だが、これは過去のスナップショットであり現在値として扱わない）。

### Coverage

| ID | Scope | Category | Applicable | Inspection performed | Result | Evidence |
|---|---|---|---|---|---|---|
| CV-1 | 複製生成物のフィールド値 | value | yes | null/空/継承値/形式違反を走査 | DS-1, DS-4, DS-5 | E-9 |
| CV-2 | 複製元への副作用 | mutation | yes | create が元を触るか確認 | DS-7（無害） | E-9 |
| CV-3 | 所有権・読み取り境界 | relation | yes | 3 経路（`findOne` / `revisions` / 一覧）を突合 | **DS-3（重大）**, DS-9, DS-11 | E-4, E-5, E-6, E-13 |
| CV-4 | status 遷移 | state-transition | yes | draft/published/deprecated からの複製 | DS-2, DS-12 | E-9, E-12 |
| CV-5 | 資源量 | value | yes | 上限検査の所在を確認 | DS-8（**未実測**） | 台帳 H-18 |
| CV-6 | ライセンス継承 | relation | yes | `license` の運用規則を探索 | DS-13（**未定義**） | entity.ts:36 |

### Scenarios

| ID | Entry path | Destructive change | Harm / failed purpose | Current defense | Classification | Impact | Confidence | Evidence | Assumption |
|---|---|---|---|---|---|---|---|---|---|
| **DS-3** | M-1 で配布テンプレの中身を `GET /sheet-templates/:id` で取ろうとする | 403 で複製が**動かない**（`assertOwner` は `system` 特例を持たない） | P-1 が達成不能。「配布テンプレをコピーしたいのにコピーできない」＝依頼の中核が失敗 | なし（front の実装ミスとして表面化） | **Prevent** | **High** | High | E-4, E-5 | — |
| **DS-1** | 複製時に元の `visibility` を継承 | 元が `public` なら複製も `public` で生成。要求者の意図しない公開 | 利用者の私的改変が公開状態で作られる | `create` は `dto.visibility ?? 'private'`＝**呼び出し側が指定できてしまう** | **Prevent** | **High** | High | E-9 | — |
| DS-5 | 名前を無加工で継承 | 一覧に同名カードが 2 枚並び、元と複製を**区別できない** | 誤ったテンプレートを編集・publish する | なし | Prevent | Medium | High | `TemplateListV3.tsx`（name のみ表示） | — |
| DS-2 | 元が `published` の状態を継承しようとする | `published` な複製が要求者所有で生まれる | 検証を経ずに公開物が増える | **既存防御あり**: `create` が `status:'draft'` を強制（E-9） | Allow（既存機構で不可能） | Low | High | E-9 | — |
| DS-4 | `version` を無加工で継承 | 複製が元と同じ `v0.1.0` を名乗る | 一覧・pin 表示で人間が混乱。`templateId` が違うため**機能的衝突はしない** | なし | Detect / Allow | Low | Medium | E-5（version は templateId 内で解決） | — |
| DS-6 | `sections`/`tables` 内の `uid`/`id` を無加工で継承 | 元と複製で同一 uid が存在 | 一意性ゲートは**テンプレート内で閉じる**（publish の canonical path / uid 検査）ため跨ぎ衝突は無害 | 既存の per-template 一意性検査 | Allow | Low | Medium | 台帳 §14 行（publish.ts:176/:529） | uid がテンプレート跨ぎで参照されない前提 |
| DS-7 | front が同一オブジェクト参照を送る | 元と複製が構造を共有 | JS 参照共有による相互汚染 | **HTTP/JSON 境界で必ず切れる** | Allow | Low | High | E-10 | — |
| DS-9 | `forkedFrom` に存在しない `templateId`/`version` を書ける | 由来が dangling リンクになる | 系譜表示が壊れる（機能被害は限定的） | **なし**（DTO は非空文字列検査のみ） | Detect | Low | High | E-13 | — |
| DS-10 | 連鎖 fork（A→B→C） | `forkedFrom` は直近 1 段のみ | 系譜を 1 段しか辿れない | なし（設計上の制約） | Allow | Low | High | E-7 | — |
| DS-11 | 複製後に元が `deprecated`／削除される | `forkedFrom` が dangling 化 | 同 DS-9 | なし | Allow | Low | High | E-9（remove は draft 削除・published は deprecate） | — |
| DS-12 | ボタン連打 | 同一元から N 個の draft が生成（冪等性なし） | 一覧がゴミで埋まる | なし | Detect | Medium | High | `TemplateListV3` の `isListPending`（既存 single-flight の型はある） | — |
| DS-8 | 巨大テンプレートの複製 | POST body / 応答サイズが上限超過 | 複製が失敗する（データ破壊はしない） | `validateForSave` は評価コストを見るが body サイズは未検査 | **Unknown** | Unknown | Low | 台帳 §1-5 H-18 行 | **未実測** |
| DS-13 | 配布元の `license` を継承しない／する | 配布元のライセンス表示が消える／不適切に引き継ぐ | 配布者の権利表示が失われる | **なし**（`license` は保存されるだけで運用規則なし） | **Unknown** | Unknown | Low | entity.ts:36 | **未定義** |

### Constraints（制約候補）

| ID | Scenarios | Derived invariant | Guarantee owner | Enforcement point | Evidence | Confidence |
|---|---|---|---|---|---|---|
| CN-1 | DS-3 | 複製元の読み取りは、**要求者所有 ∪（system 所有かつ published）** の面のみを使う | ドメイン（`assertRevisionReadableBy` 相当） | M-2 なら service / M-1 なら front の分岐 | E-4, E-5 | High |
| CN-2 | DS-1 | 複製生成物の `visibility` は **常に `private`**。複製元の値を継承しない | ドメイン | 複製操作の生成点 | E-9 | High |
| CN-3 | DS-5 | 複製生成物の `name` は元と**識別可能**でなければならない | UI or ドメイン | 生成点 or 入力 | — | Medium |
| CN-4 | DS-2 | 複製生成物は `status='draft'` ∧ `draftRevision=1` | ドメイン（**既に成立**） | `create`（E-9） | E-9 | High |
| CN-5 | DS-7, 全般 | 複製操作は複製元を変更しない（`draftRevision`/`status`/`publishedAt`/`updatedAt` 不変） | ドメイン | 複製操作 | E-12 | High |
| CN-6 | DS-9, DS-11 | `forkedFrom` は**由来の記録であって参照整合性を保証しない**（dangling を許容する） | 設計判断 | 表示側が解決失敗を許容 | E-13 | Medium |
| CN-7 | DS-12 | 複製操作は送信中に再送されない（single-flight） | UI | ボタン | `TemplateListV3` の `isListPending` | Medium |
| CN-8 | DS-4 | `version` の既定値を決める（継承 or リセット）— **未決** | 設計判断 | 生成点 | E-5 | Low |

### Handling Decisions

| ID | Scenario | Classification | Owner | Prevent / Detect / Allow | Decision authority | Verification trigger |
|---|---|---|---|---|---|---|
| HD-1 | DS-3 | Prevent | 実装 | CN-1。**M-2 なら server が保証、M-1 なら front が正しい面を選ぶ責任を負う** | Q-1 | 配布テンプレの複製が 200 で通る spec |
| HD-2 | DS-1 | Prevent | 実装 | CN-2。複製操作が `visibility` 引数を**受け取らない**形にする | 設計（本 doc） | `visibility==='private'` の spec |
| HD-3 | DS-5 | Prevent | 実装 | CN-3。既定名を `{元名} のコピー` にするか、Modal で入力必須にする | **Q-2** | 同名生成の否定 spec |
| HD-4 | DS-4 | Allow | 設計 | 機能的衝突なし。人間の混乱は CN-3 の名前差で吸収 | **Q-4**（版のリセット可否） | — |
| HD-5 | DS-6, DS-7, DS-10, DS-11 | Allow | 設計 | v1 は受容。理由は Scenarios 表の Current defense 欄 | 設計（本 doc） | — |
| HD-6 | DS-9 | Detect | 実装 | 表示側で解決失敗を握りつぶす（エラーにしない） | 設計（本 doc） | — |
| HD-7 | DS-12 | Detect | 実装 | CN-7。既存 `isListPending` パターンを流用 | 設計（本 doc） | 連打で 1 回のみ送信の spec |
| HD-8 | DS-8 | **未評価** | — | 実測が要る | 実装前の計測 | `legacy-coc` 実物での body サイズ計測 |
| HD-9 | DS-13 | **未評価** | — | `license` の運用規則が未定義 | **Q-3 と併せてユーザー** | — |

### Missing Tests

| ID | Scenarios | Constraints | Given / When / Then | Level |
|---|---|---|---|---|
| T-1 | DS-3 | CN-1 | **配布（system 所有・published）テンプレート** / 非所有者が複製 / 200 で自分の draft が生成される | integration（server）or e2e |
| T-2 | DS-3 | CN-1 | **他人所有の private テンプレート** の templateId / 複製 / 403 または 404（読み取り境界が広がっていない） | integration |
| T-3 | DS-1 | CN-2 | 複製元 `visibility='public'` / 複製 / 生成物 `visibility==='private'` | unit（service） |
| T-4 | DS-2 | CN-4 | 複製元 `status='published'` / 複製 / 生成物 `status==='draft'` ∧ `draftRevision===1` | unit |
| T-5 | — | CN-5 | 複製元の全フィールド / 複製 / 複製元の `draftRevision`/`status`/`updatedAt` が操作前後で不変 | integration |
| T-6 | — | G-5 | 複製 / 生成物の `forkedFrom` が `{元 templateId, 元 version}` | unit |
| T-7 | DS-5 | CN-3 | 同一元から複製 / 一覧 / 元と複製の名前が異なる | unit（front） |
| T-8 | DS-12 | CN-7 | 複製ボタン連打 / / 送信が 1 回のみ | unit（front） |
| T-9 | IS-3 | G-2 | 実配布テンプレ `legacy-coc` の全体 / 複製経路（`validateForSave`）/ 400 が出ない | integration |

### Domain Questions

| ID | Related | Unknown | Impact | Confirmation method |
|---|---|---|---|---|
| DQ-1 | IS-3, T-9 | `validateForPublish` を通った published テンプレートが `validateForSave` を必ず通るか | 通らないと G-1 が成立しない（複製が 400） | `seeds/legacy-coc.template.ts` を create 経路へ流す integration spec |
| DQ-2 | DS-8 | 実配布テンプレートの POST body サイズ | 上限があれば複製が失敗しうる | `legacy-coc` の JSON バイト数を計測 |
| DQ-3 | DS-13 | `license` の運用規則（誰が何を保証するか） | 配布元の権利表示 | ユーザー裁定（Q-3 と併せて） |

---

## S4. Domain Contract（不変条件の契約化）

Result: **Partial**
Model purpose: **既存のシートテンプレートを土台に、要求者所有の編集可能な draft を 1 件生成する**
Normal state: 生成後の draft は「新 `templateId` ／ 要求者所有 ／ `status='draft'` ／ `draftRevision=1` ／ `visibility='private'` ／ 構造は元と等価 ／ 由来を保持」であり、**複製元は不変**。

### Operations

| ID | Inputs | Caller responsibility | Supplier responsibility | Success result | Old → new state | Expected rejection | Contract-violation bug | Error representation | Failure state | Atomicity / side effects |
|---|---|---|---|---|---|---|---|---|---|---|
| **OP-1** `forkSheetTemplate` | `sourceTemplateId`, `requesterDiscordUserId`（**§S7 改訂: `sourceVersion` は wire 入力から外す** — 下記注） | 認証済みであること。`sourceTemplateId` は一覧 summary から取得した値であること | C-1〜C-9 の全成立。複製元を変更しないこと | 新 `CharacterSheetTemplateEntity`（draft） | source: **不変** ／ 新規 1 件が追加 | 元が不存在 → 404 ／ 読み取り不可（他人所有かつ非 system） → 403 ／ **〔§S7 訂正〕status ゲートは分岐別**: 自分所有 = **status 不問**（draft/published/deprecated すべて fork 可・`findOne` 相当）／ system 所有 = **published のみ**（deprecated は v1 拒否 409 — 一覧に出る配布物だけが入口） ／ 構造が `validateForSave` 不通過 → 400（§S6 CR-1 により元構造由来では発生しない） | 生成物が `published` になる・`author` が要求者でない・元が変わる | 既存の Nest 例外（`NotFoundException`/`ForbiddenException`/`ConflictException`/`BadRequestException`）。**新しいエラー語彙を作らない** | **何も生成されない**（元も無変更） | `create` 1 回のみ＝単一書き込みで原子的。副作用は新規 1 ドキュメント |

**〔実装註・L-5〕** service メソッド名は **`fork`**（本 doc の旧表記 `forkSheetTemplate` から変更）。
既存 service の命名規約（create/update/publish/remove = 裸の動詞）に整合させた。
front action 名は §S5 CD-5 どおり `forkTemplate`。

**〔§S7 注 — `sourceVersion` を wire から外す決定〕** 旧 OP-1 は `resolveForCreate` の形を引きずって
`sourceVersion` を入力に置いていたが、Phase 2 は templateId ごと単一バージョン（service.ts:207-208）であり、
版指定は「一覧で見た version と今の version が違ったら 409」という**失敗経路を増やすだけ**。
route は `POST /sheet-templates/:id/fork`（body なし）とし、`forkedFrom.version` には
**server が読み取った時点の version** を記録する。これで G-1（1 操作で完了）と整合し、
Sonnet R2 の未決指摘（body/query の運搬形）も解消する。定型化された設計判断として Fable が決定・ユーザー却下可。

### Completeness Inventory

| ID | Kind | Purpose contribution | Scope | Evidence | Rationale |
|---|---|---|---|---|---|
| EL-1 | data: `sections`/`tables`/`settings` | G-2（構造の等価） | **target**（継承する） | E-9 | 複製の実体 |
| EL-2 | data: `name` | CN-3（識別可能性） | **target**（加工する） | DS-5 | 無加工継承は破壊シナリオ |
| EL-3 | data: `visibility` | CN-2 | **target**（`private` 固定） | E-9, DS-1 | 継承すると意図しない公開 |
| EL-4 | data: `templateId`/`status`/`draftRevision`/`authorDiscordUserId` | C-1〜C-3 | **target**（`create` が強制・既に成立） | E-9 | 継承してはならない |
| EL-5 | data: `forkedFrom` | G-5 | **target**（新規に書く） | E-7 | 初の producer |
| EL-6 | data: `version` | — | **unknown** | DS-4 | 継承 or リセットが未決（Q-4） |
| EL-7 | data: `gameSystemId`/`tags` | — | **target**（継承する） | E-9 | 改変版でもゲームシステム・分類は同じ |
| EL-8 | data: `license` | DS-13 | **unknown** | entity.ts:36 | 運用規則が未定義（Q-3） |
| EL-9 | data: `publishedAt`/`createdAt`/`updatedAt` | — | **excluded** | E-9 | 継承しない（永続化層が採番） |
| EL-10 | state-transition | CN-4 | **target**（`* → draft` のみ） | E-9 | published からの複製も draft になる |
| EL-11 | operation: 読み取り | CN-1 | **target** | E-4, E-5 | **最大の設計論点**（DS-3） |

### Conditions

| ID | Operation | Kind | Condition | Contract boundary | Enforcement owner | Evidence |
|---|---|---|---|---|---|---|
| **C-1** | OP-1 | Invariant | 生成物の `authorDiscordUserId` === 要求者 | 生成完了時 | ドメイン（`create` が既に強制） | E-9 |
| **C-2** | OP-1 | Invariant | 生成物の `status === 'draft'` ∧ `draftRevision === 1` | 生成完了時 | ドメイン（**既に成立**） | E-9 |
| **C-3** | OP-1 | Invariant | 生成物の `templateId` ≠ 複製元の `templateId` | 生成完了時 | ドメイン（`uuidv4()`） | E-9 |
| **C-4** | OP-1 | Post | 複製元の `draftRevision`/`status`/`publishedAt`/`updatedAt` が操作前後で不変 | 操作正常終了時 | ドメイン | E-12 |
| **C-5** | OP-1 | Pre | 複製元が「要求者所有」または「`system` 所有かつ `published`」 | 操作開始時 | **Q-1 依存**（M-2 なら service / M-1 なら front） | E-4, E-5, E-6 |
| **C-6** | OP-1 | Invariant | 生成物の `visibility === 'private'` | 生成完了時 | **要設計**。複製操作は `visibility` を**引数に取らない**形にする | E-9, DS-1 |
| **C-7** | OP-1 | Post | 生成物の `forkedFrom` === `{ 複製元 templateId, 複製元 version }` | 操作正常終了時 | ドメイン | E-7 |
| **C-8** | OP-1 | Invariant | 本操作は既存の読み取り境界を**拡張しない**（`assertRevisionReadableBy` と同一の許可集合） | 操作開始時 | ドメイン | E-5 |
| **C-9** | OP-1 | Failure | 失敗時は**何も生成されない**（部分生成なし） | 失敗時 | `create` 単一書き込みで自明 | E-9 |

**規約頼み（破っても全緑になりうる）＝ 委譲プロンプトへ名指しで転記する条件**: C-5・C-6・C-8。
とくに **C-6 は `create` の `dto.visibility ?? 'private'`（E-9）を通るため、複製経路が `visibility` を渡した瞬間に破れる**。
これは台帳 §2-2 が扱う「規約・コメント頼み」の典型であり、**M-2 を推す最大の技術的理由**。

### One-condition Tests

| ID | Condition | Expected outcome | Failure-state assertion | Level |
|---|---|---|---|---|
| CT-1 | C-1 | 生成物の author が要求者 | — | unit |
| CT-2 | C-2 | `status==='draft'` ∧ `draftRevision===1`（元が published でも） | — | unit |
| CT-3 | C-4 | 元の 4 フィールドが操作前後で一致 | — | integration |
| CT-4 | C-5 | 他人 private の複製が 403/404 | 生成物が 0 件 | integration |
| CT-5 | C-6 | 元が `public` でも生成物は `private` | — | unit |
| CT-6 | C-7 | `forkedFrom` が元の `{templateId, version}` | — | unit |
| CT-7 | C-9 | `validateForSave` 失敗時に生成物 0 件 | 一覧件数が不変 | integration |

### Gaps and Questions

| ID | Related | Unknown / conflict | Impact | Decision authority | Confirmation method |
|---|---|---|---|---|---|
| GP-1 | C-5, C-8, EL-11 | **強制点を server に置くか front に置くか**（M-1 vs M-2） | C-6/C-8 の破れやすさ・front の認知負荷 | **ユーザー（Q-1）** | 本 doc の推奨を承認 |
| GP-2 | EL-6 | `version` の既定 | 人間の混乱のみ | ユーザー（Q-4） | — |
| GP-3 | EL-8 | `license` の運用 | 配布元の権利表示 | ユーザー（Q-3） | — |
| GP-4 | DQ-1 | published → `validateForSave` の通過保証 | 未通過なら OP-1 が成立しない | 実測 | T-9 |

---

## S5. Purpose-driven Naming（命名）

Result: **Complete**
本 Skill は提案のみ。**コードは変更していない**。

### Symbols

| ID | Definition locator | Current name | Actual purpose | Reference-search status | Public-contract impact | Evidence |
|---|---|---|---|---|---|---|
| SY-1 | 新規（`TemplateListV3.tsx` のカード内） | — | 「編集できる自分の draft を得る」導線のラベル | 新規のため参照 0 | UI 文言のみ | E-2 |
| SY-2 | 新規（`app/features/characterTemplate/actions.ts`） | — | Server Action | 新規 | front 内部 | E-10 |
| SY-3 | 新規（M-2 採用時: controller / service） | — | HTTP route ＋ service メソッド | 新規 | **公開 API** | E-9 |
| SY-4 | 既存 `models/character-sheet-template.entity.ts:35` | `forkedFrom` | 由来の記録 | **全層に配線済み・producer 0**（grep 全件） | 公開契約（summary 投影・repository select） | E-7 |

### Candidates

| ID | Symbol | Candidate | Purpose | Included meaning | Excluded meaning | Collision | Decision and rationale |
|---|---|---|---|---|---|---|---|
| CD-1 | SY-1 | **「複製して編集」** | P-1 | 生成物が自分のもので、編集できる | クリップボード（I-2）／外部取り込み（I-3） | なし | **採用推奨**。目的（編集できる自分の draft）を名前が直接語る |
| CD-2 | SY-1 | 「コピー」 | — | — | — | **I-2 と誤読余地** | 不採用。「コピー」単独はクリップボードと読める |
| CD-3 | SY-1 | 「draft として作成」 | — | — | — | **既存「v3 draft として作成」（E-10）と衝突** | 不採用。2 導線を区別できなくなる |
| CD-4 | SY-1 | 「フォーク」 | — | — | — | 一般利用者に馴染まない | 不採用。UI は日本語の目的語で |
| CD-5 | SY-2 | **`forkTemplate`** | P-1 | 由来を保持した複製 | — | なし | **採用推奨**。`forkedFrom`（SY-4）と**同一語根**で語彙が 1 本になる |
| CD-6 | SY-2 | `copyTemplate` | — | — | — | `forkedFrom` と語根が割れ、**「コピー」と「fork」の二重語彙**が生まれる | 不採用（Q-3 で `forkedFrom` を書かない裁定なら CD-6 が正になる） |
| CD-7 | SY-2 | `createTemplateFromExisting` | — | — | — | 既存 `createTemplate`（E-10）と紛らわしい | 不採用 |
| CD-8 | SY-3 | **`POST /sheet-templates/:id/fork`** | P-1 | 既存 `/:id/publish`（controller.ts:89）と同じ「id ＋ 動詞」形 | — | なし | **採用推奨**（M-2 採用時） |
| CD-9 | SY-4 | `forkedFrom`（**現状維持**） | P-3 | 由来 | 参照整合性の保証（CN-6） | — | **採用**。新語 `copiedFrom` を作らない。既存の公開契約（summary 投影・repository select 文字列）を変えない |

既存 front actions の命名は `createTemplate` / `importV2Template` / `deleteTemplate` / `createCharacter` / `saveTemplateDraft`（E-10）＝
**動詞 ＋ 目的語**。`forkTemplate` はこの規則と整合する。

### Rename Plan

| Step | Impact locator | Deterministic method | Compatibility action | Verification | Approval |
|---|---|---|---|---|---|
| — | — | **rename は発生しない**（全て新規追加。SY-4 は現状維持） | — | — | — |

唯一の注意点: `forkedFrom` の **初の producer** が生まれるため、
「`forkedFrom` は書かれないフィールド」という暗黙の前提に依存した spec があれば壊れる。
→ 実装時に `forkedFrom` を含む既存 spec（`repository.spec.ts:76,97,116,174` の select 文字列 pin）に**変更が出ないこと**を確認する。

### Issues and Contract Checks

| ID | Type | Related | Pass/Fail | Evidence | Recovery |
|---|---|---|---|---|---|
| NC-1 | Precondition | 定義と主要参照を検索できる | Pass | grep 全件（E-7） | — |
| NC-2 | Precondition | 目的と文脈を根拠付きで確認 | Pass | P-1 Confirmed（E-1） | — |
| NC-3 | Precondition | 公開 API・永続化への影響を確認 | Pass | SY-4 は現状維持のため影響なし | — |
| NC-4 | Postcondition | 採用名が 1 目的 1 文脈へ追跡可能 | Pass | CD-1/5/8/9 → P-1・P-3 | — |
| NC-5 | Postcondition | 既存ユビキタス言語と非衝突 | Pass | CD-3 の衝突を検出して不採用 | — |
| NC-6 | Invariant | このSkillが rename を実行していない | Pass | Rename Plan が空 | — |

---

## 推奨（承認待ち）

### 手段: **M-2（server 専用操作 `POST /sheet-templates/:id/fork`）を推奨**

理由は 3 つ、いずれも実測に基づく。

1. **C-6 の強制点がドメインに無いと破れる**。`create` は `visibility: dto.visibility ?? 'private'`（service.ts:47）で
   呼び出し側の指定を受ける。複製を front 合成（M-1）で組むと、「複製は private」は
   **front のコード規約でしか守られない**＝台帳 §2-2 の「破っても全緑」カテゴリに新しい項目を 1 つ増やす。
2. **DS-3 の読み取り 2 面分岐が front に露出する**。配布テンプレは `GET /:id/revisions/:version`、
   自分のは `GET /:id`（E-4/E-5）。M-1 はこの分岐を front が持つ。M-2 なら server 内で 1 本化でき、
   front の同時保持概念が減る（fable-rules の認知負荷最重視と整合）。
3. **`assertRevisionReadableBy` のコメント「mutation は所有者限定のまま変更しない」（service.ts:217）**が
   示す既存の設計意図に、複製という新しい mutation を**明示的に位置づけられる**。

M-1 の利点（server 変更ゼロ・最短）は本物なので、**Q-1 の回答次第では M-1 も妥当**。
とくに複製元を**配布テンプレートのみ**に限るなら、front は 1 面（`GET /:id/revisions/:version`）だけで済み、
M-1 の欠点 2 が消える（欠点 1 は残る）。

### 実装スライス（M-2 採用時・fable-rules 経由で委譲）

| # | スライス | 委譲先 | 検収 |
|---|---|---|---|
| F-1 | server: `forkSheetTemplate`（service）＋ `POST /:id/fork`（controller）＋ DTO | Opus or Codex | CT-1〜CT-7 ＋ T-9（DQ-1 の実測） |
| F-2 | front: `forkTemplate` action ＋ カードの「複製して編集」ボタン（配布・自分の両方） | Opus or Codex | T-8 ＋ 一覧 spec の『…だけを表示する』2 テストへ複製ボタン assertion を**追記**（§S7 CR-7。本行の旧記載「既存 spec 無変更」は CR-7 と矛盾していたため 2026-08-18 訂正）。T-7（名前差）は M-2 確定により server spec が担う |
| F-3 | 大粒度: 認知負荷レビュー（`importV2Template` と `forkTemplate` の重複実装検査） | 二重レビュー | 同一ロジック重複の検出 |

**out-of-scope（YAGNI 検収の対象・実装させない）**: 系譜の可視化 UI／連鎖 fork の多段追跡／
テンプレートの公開閲覧／キャラクターシート自体のコピー（台帳 §1-5・v1.1 延期のまま）。

### 人間の決定点（**2026-08-18 ユーザー裁定・全 5 件決着**）

| ID | 問い | **裁定** | 波及 |
|---|---|---|---|
| **Q-1** | 複製元は配布テンプレートのみか、自分のテンプレートも含むか | **自分のも含む** | I-9 Unknown → **Confirmed**／P-2 Inferred → **Confirmed**／IS-1 解決／**読み取り面が 2 つ必要**（`GET /:id` と `GET /:id/revisions/:version`）＝ M-2 推奨の根拠 2 が有効なまま |
| **Q-2** | 複製後の名前 | **`{元名} のコピー` を既定。編集画面で変更できればよい** | CN-3・HD-3 決着。**Modal 不要＝ 1 操作で完了**（G-1 の「1 操作」がそのまま成立）。名前入力 UI は out-of-scope |
| **Q-3** | `forkedFrom` を書くか | **書く** | P-3 Inferred → **Confirmed**／G-5 確定／IS-2 解決／CD-5 `forkTemplate`・CD-8 `/:id/fork`・CD-9 `forkedFrom` 現状維持が**採用確定**、CD-6 `copyTemplate` は不採用確定 |
| **Q-4** | `version` の既定 | **元の version を継承** | EL-6 unknown → **target**／CN-8 決着／DS-4 は **Allow 確定**（`templateId` が違うため機能的衝突なし） |
| **Q-5** | 台帳 §1-5 へ「テンプレート複製はシート複製と別物」と追記するか | **追記する** | BS-1 を台帳へ反映（後続ループの誤停止防止） |

**手段の確定**: Q-1 が「自分のも含む」となったため、front 合成案（M-1）は読み取り 2 面の分岐を front に持つことになる。
M-2 を推す 3 理由（C-6 の強制点・読み取り 2 面・既存 mutation 境界との整合）が**すべて有効**。
→ **M-2（`POST /sheet-templates/:id/fork`）で確定**。

### 裁定後も未確認のまま残るもの

| ID | 未確認事項 | 扱い |
|---|---|---|
| ~~DQ-1~~ | ~~published を通ったテンプレートが `validateForSave` を必ず通るか~~ | **2026-08-18 解消（§S6 で分析的に決着）**。着手前ゲートは不要 |
| DQ-2 | 実配布テンプレートの POST body サイズ（DS-8） | 実測。上限に当たれば複製が失敗しうる（低優先） |
| DQ-3 | **`license` の継承規則（DS-13）** | **未決のまま**。Q-3 の回答は `forkedFrom` に対するもので、`license` は別問い。v1 は「元の値をそのまま継承」を暫定既定とし、権利表示の要否は別途裁定 |
| **DQ-4** | **`forkedFrom` の事後可変性（C-10）** | **未決**。C-7 は生成時点しか縛っていない |

---

## S6. Haiku レビュー反映（2026-08-18）

Haiku 2 体（コードベース側の暗黙知／設計書の無自覚な前提）にレビューさせ、Fable が全件を実測で検収した。
**採否は実測の結果であり、レビュアーの主張をそのまま採らない。**

### 追加証拠

| ID | Type | Locator | Content |
|---|---|---|---|
| **E-14** | code | `validation/sheet-engine-template-validation.service.ts:11-13, 26-31` | `validateForSave` の実体は `validatePublishTemplate(toEngineTemplate(t))` **1 段のみ** |
| **E-15** | code | `validation/template-publish-validation-issue.collector.ts:25-38` | `validateForPublish` の collector は engine → standalone-notation → projection-key の 3 段。**stage 1 は E-14 と同一関数呼び出し** |
| **E-16** | code | `validation/sheet-engine-template-validation.service.ts:15-18` | **`validateForPublish` は `visibility === 'public'` を要求**し、違反は 400 |
| **E-17** | code | `core/http/response-interceptor-application.spec.ts:29-33` | 「bare response controller に ResponseInterceptor が適用されていない」として `CharacterSheetTemplateController` を **spec で pin** |
| **E-18** | code | `character-sheet-template.service.ts:272-286`（`pickDraftUpdate`）:280 | draft 保存は `dto.forkedFrom !== undefined` のとき `updateData.forkedFrom` を**上書きする** |
| **E-19** | code | `trpg-next-app/app/features/characterTemplate/actions.ts:191-206`（`toUpdateRequest`）:200 | エディタの保存要求は `forkedFrom` を**常に送る** |

### 採用した指摘

| ID | 指摘 | 実測による裏取り | 設計への反映 |
|---|---|---|---|
| **AD-1** | `ResponseInterceptor` が sheet-templates に適用されない | E-17（**spec で pin されている**＝規約ではなく機械固定） | **新条件 C-11**。新 route も bare response を返す。front は `response.data` を読む（`response.data.data` ではない） |
| **AD-2** | `forkedFrom` の上書き規則が未定（連鎖 fork） | E-18 ＋ E-19。**エディタ保存が毎回 `forkedFrom` を送る**ため、front の state が由来を持つ限り値は保存されるが、**別の値を送れば書き換わる** | **新条件 C-10**（下記）。DQ-4 として未決に追加 |
| **AD-3** | C-6 の強制点が DTO の既定値に埋没している | E-16 で**害が確定**（下記 CR-2） | C-6 の格上げ。`fork` は `visibility` を引数に取らない形にする |
| **AD-4** | 複製中に複製元が publish される競合（XS-1） | 複製は単一の読み取り＋単一の `create`。取得できるのは publish 前後どちらかのスナップショット | **Allow**。どちらのスナップショットでも C-1〜C-9 は成立する |
| **AD-5** | `normalizeTemplateLayout` は server 側に存在せず front 保存経路のみが担保 | 台帳 #9 の実測記録と一致 | **記録のみ**。複製は保存済みの形をそのまま写すため、複製が新たな未正規化を生むわけではない。ただし **M-1（front 合成）は front の正規化を通り、M-2 は通らない** ⇒ 同じ操作でも出力が変わりうる点を実装時に意識する |

### 却下・訂正した指摘

| ID | レビュアーの主張 | 実測 | 判定 |
|---|---|---|---|
| **CR-1** | 「published テンプレートが `validateForSave` を通る保証がなく本番バグのリスク」（DQ-1 を blocker 扱い） | E-14 ＋ E-15。`validateForSave` の検査集合は `validateForPublish` の**真部分集合**（stage 1 が同一関数） | **却下**。published を通った構造は save を必ず通る。**DQ-1 は分析的に解消**し、着手前ゲートは不要。残余リスクは fork が変更する `name`（`{元名} のコピー`）が engine の長さ制約に触る場合のみで、元の構造由来の失敗はありえない |
| **CR-2** | 「複製経路では standalone-notation と projection-key が無視される」 | 事実だが**害の方向が逆**。無視されるのは検査が**緩い**方向であり、複製が 400 で落ちる原因にはならない | **訂正して採用**。落ちる理由にはならないが、「複製直後の draft は publish 検証を通っていない」＝ 複製物を publish するには元と同じ 3 段検証を通す必要がある（既存の draft と同じ扱い・新規の問題ではない） |
| **CR-3** | 「fork が publish 後の更新を 409 にする」 | `toUpdateRequest` は `version` を無条件に送る（E-19）ため `hasStructuralUpdate`（service.ts:249-261）は**既に true**。409 は fork 以前からの既存挙動 | **却下**。fork 由来の新規経路ではない |
| **CR-4** | 「summary select から `forkedFrom` を削除しても spec は通る」 | `repository.spec.ts:76, 97, 116, 174` が select 文字列を**完全一致で pin** している | **却下**（レビュアー自身の別項目と矛盾していた） |

### E-16 から導かれる確定事項（**本レビュー最大の成果**）

`validateForPublish` は `visibility === 'public'` を要求する（E-16）。ゆえに:

1. ~~**published なテンプレートは例外なく `visibility === 'public'`**。配布テンプレート（system 所有・published）も全件 public。~~
   **〔2026-08-18 §S7 で訂正 — 主張強度の誤り〕** この命題が成立するのは **`publish()` 操作を経由した行に限る**。
   配布テンプレート第一号 `legacy-coc` は `status:'published'` ∧ `visibility:'private'` を
   **`publish()` を経由せず** `repository.create()` へ直接投入した実在の反例（E-21・seed 自身の
   NOTE コメントが「規約例外」と明記）。「published なら必ず public」は **DB 全体の保証ではない**。
2. したがって **DS-1（visibility 継承）の害は仮説ではなく確定**。継承すれば配布テンプレの複製は**全件 public** で生成される。
   **C-6 は防御的な細工ではなく、機能が壊れないための成立条件**。
3. 逆に、fork の出力は `private` なので**そのままでは publish できない**（400）。
   これは `createTemplate`（`actions.ts:41-60` も private 生成）と同じ既存挙動であり、
   **「fork した draft を publish するには visibility を public へ変える」が正しい手順**。
   委譲先が「publish できないのはバグだ」と誤認して fork に public を継承させないよう、
   この段落を委譲プロンプトへ転記する。

### 追加条件

| ID | Operation | Kind | Condition | Enforcement owner | Evidence |
|---|---|---|---|---|---|
| **C-10** | OP-1 ＋ 既存 update | Invariant **候補** | **`forkedFrom` は生成時に確定し、以後変更されない**（連鎖 fork でも上書きしない） | **未決（DQ-4）**。強制するなら `pickDraftUpdate` から `forkedFrom` を外す＝**既存挙動の変更**になるため裁定が要る。**〔2026-08-18 F-3 Codex 指摘で精密化〕v1 の出荷状態 = 可変（既存 update 経路の現状維持）**: update DTO は forkedFrom を受理し（update DTO:40）・`pickDraftUpdate` が保存し（service.ts:280 相当）・front `toUpdateRequest` が毎保存で送る（actions.ts:200 相当）。fork spec が pin するのは生成時の 1 点のみで、生成後の由来保持は**どの spec も固定していない**。裁定の選択肢: (a) 不変化 = allow-list から外す＋「異なる値を送っても旧値維持」spec＋front 送信停止 (b) 可変を契約として明記＋上書き可能な旨を spec で pin。**曖昧なまま放置しない**（ambiguity 自体が Codex の correctness 指摘） | E-18, E-19 |
| **C-11** | OP-1 | Invariant | 新 route の応答は **bare response**（`ResponseInterceptor` 非適用）。front は `response.data` を読む | 機械固定（spec pin） | E-17 |

### 委譲プロンプトへ転記する定型文

```
■ visibility は private 固定（C-6・E-16）
fork の出力は必ず visibility='private'。fork 操作は visibility を引数に取らないこと。
create() の既定値 `dto.visibility ?? 'private'` に頼ってはならない（呼び出し側が指定できてしまう）。
理由: publish は visibility==='public' を要求するため、published テンプレートは全件 public。
継承すると配布テンプレの複製が全件 public になる。
なお fork 出力は private なのでそのままでは publish できない。これは新規作成と同じ既存挙動であり
バグではない。「publish できるように」と public を継承させないこと。

■ mutation の権限境界を広げない（C-5・C-8）
assertRevisionReadableBy の system 特例は「読み取り限定」。service.ts:217 のコメント
「mutation は所有者限定のまま変更しない」を破らないこと。
fork が読める複製元は「要求者所有」∪「system 所有かつ published」のみ。
他人所有の private/draft へ到達する経路を作らない。

■ 読み取り面は 2 つある（DS-3）
自分所有 = findOne（assertOwner を通る）／配布 = resolvePinnedRevision 系（system 特例あり）。
findOne は system 特例を持たないため、配布テンプレを findOne で取ると 403 になり機能が成立しない。

■ 応答は封筒なし（C-11）
CharacterSheetTemplateController は ResponseInterceptor 非適用で、これは
core/http/response-interceptor-application.spec.ts が pin している。
新 route も bare response。front は response.data を読む（response.data.data ではない）。
この spec の期待値を書き換えないこと。

■ forkedFrom は既存フィールド（CD-9）
copiedFrom 等の新語を作らない。entity / DTO / repository の select 文字列 /
summary の Pick は既に forkedFrom を含み、repository.spec.ts:76,97,116,174 が
select 文字列を完全一致で pin している。select から外さないこと。
本機能が forkedFrom の初の production producer になる。

■ 検証の非対称（CR-1・CR-2）
validateForSave は validatePublishTemplate 1 段のみ。
validateForPublish は visibility 検査 ＋ engine/standalone-notation/projection-key の 3 段。
published を通った構造は save を必ず通るので、複製が構造由来で 400 になることはない。
```

---

## S7. レビュー第 2 ラウンド反映（2026-08-18・Haiku＝テスト/ゲート基盤・Sonnet＝下流/境界横断）

第 1 ラウンドと重複しないレンズで 2 体に暗黙知を掘らせ、Fable が全採用項目を実測検収した。
**§S6 の自明張り（「published は例外なく public」）への実在反例が見つかり、自己訂正した**（CR-5）。

### 追加証拠（全件 Fable 実測済み）

| ID | Locator | Content |
|---|---|---|
| **E-20** | `TRPG-SERVER/jest.config.js:76-94` | server の coverageThreshold: global { branches 70 / functions 80 / lines 80 / statements 80 } ＋ `core/http/error-handler.ts`・`domains/auth/` の個別強化枠。**front（trpg-next-app）の `jest.config.cjs` には閾値なし** |
| **E-21** | `src/scripts/seed-legacy-coc-template.ts:60-79, 93-96` ＋ `seeds/legacy-coc.template.ts:52` | **`legacy-coc` は `status:'published'` ∧ `visibility:'private'`**。`publish()` を経由せず repository 直接投入。NOTE コメント「規約例外 … visibility 方針だけを外し、残る 3 検証は同じ関数・同じ順序で再利用」 |
| **E-22** | `src/core/http/validation-pipe.provider.ts:4-7` ＋ `app.module.spec.ts:153-158` | ValidationPipe は `{ transform: true, whitelist: true }` **のみ**（`forbidNonWhitelisted` なし）で、その組み合わせを spec が `toStrictEqual` で pin。**DTO にないフィールドは 400 にならず黙って剥がされる** |
| **E-23** | `app.module.spec.ts:160-199` | (a) 到達可能 controller 名の**厳密一致 pin**（クラス単位 — fork はメソッド追加なので無編集で通る）(b) **全 controller/method/parameter に local pipe が無いことを動的走査で assert** — fork route に `@UsePipes` を付けると即赤 |
| **E-24** | `TRPG-SERVER/package.json:18-23` | `test` / `test:cov` / `typecheck:test` は **`ensure:workspace-dist`（workspace 依存の build）を前置**。素の `jest` 単発起動はこの前置を通らず、engine の stale dist で偽緑になりうる |
| **E-25** | `eslint.config.mjs:118-132`（server） | `domains/**` から `features/**` への import は no-restricted-imports で **error**。fork service は `domains/character-sheet-template` 内で完結させる |
| **E-26** | `packages/api-contract/src/character-sheet-template/character-sheet-template.zod.ts:1-8` | 冒頭コメント「**HTTP wire の形ではない**…フロントエンド／ブラウザでこのスキーマを parse しないこと。wire 用の型が必要になったら別途書き下ろす」。**sheet-template に wire schema は存在せず、既存 4 route はローカル型 `types/v3.ts` で完結** ⇒ fork で api-contract を触らない |
| **E-27** | `trpg-next-app/AI.md:21-30, 73-84` | (a) feature 間の許可辺 5 本のうち ② `characterTemplate → character` は **`createCharacterFromTemplate` 専用** — fork はキャラを作らないのでこの辺を使わない (b) **新規 Server Action は `{ error: string \| null }` ＋追加データを同一オブジェクトに足す規約**（共有 generic 型は作らない・大粒度レビュー#1 裁定） |
| **E-28** | `controller.spec.ts:63-71` ＋ `TemplateListV3.spec.tsx:94-118` | (a) controller spec の serviceMock は **7 メソッド列挙**（`forkSheetTemplate` 追加漏れで undefined 参照）(b) 一覧 spec の assertion は**個数でなく name 指定**（`queryByRole('link', { name: '編集' })` 等） |

### 採用・訂正・却下

| ID | 出所 | 指摘 | Fable 検収 | 判定 |
|---|---|---|---|---|
| **CR-5** | Sonnet FD-2 | §S6 の「published は例外なく public」に反例（legacy-coc） | E-21 で**確定**。§S6 の該当段落へ訂正を挿入済み | **採用（自己訂正）**。C-6 の結論（private 固定・visibility を引数に取らない）は不変だが、根拠を「published⇒public だから」ではなく「**継承元の値を無条件に信用しない独立の防御**」へ差し替える。なお legacy-coc を fork すると継承なら private になり偶然無害だが、ユーザー自身が publish した public テンプレの self-fork では継承が実害になる — 防御の必要性自体は残る |
| **CR-6** | Sonnet FD-1 | OP-1 の Expected rejection「published でない → 409」が分岐を跨いで一括表記で、**自分の draft を fork できない読みになる** — §S6 定型文（自分所有 = findOne）と自己矛盾 | service.ts:66-70（findOne に status ゲートなし）vs :72-98（版解決 2 メソッドは allowedStatuses 必須）で確認 | **採用**。OP-1 を分岐別に訂正済み: 自分所有 = **status 不問**／system = published のみ（deprecated は v1 拒否）。**既存の版解決 2 メソッドへ寄せて実装すると自分の draft の fork が死ぬ** — fork 専用の読み取りを service 内に書く |
| **DEC-1** | Sonnet 未決指摘 | `sourceVersion` の運搬形（body/query）が未定 | — | **Fable 決定（ユーザー却下可）**: wire 入力から**外す**。`POST /:id/fork` body なし・`forkedFrom.version` は server が読んだ時点の version。理由は OP-1 の §S7 注 |
| AD-6 | Haiku IK-3 | 未知フィールドは黙って剥がされる（whitelist・forbidNonWhitelisted なし） | E-22 | **採用**。fork DTO を「フィールドなし（または `name?` すら持たない）」にすれば、`visibility:'public'` を body に載せた攻撃的リクエストも**無言で除去**され C-6 と整合 |
| AD-7 | Haiku IK-1 | server coverage threshold で spec 薄めの新規ファイルが global を沈める | E-20 | **採用**。F-1 の検収に `test:cov` 通過を含める。**front には閾値がない**（旧 trpg-remix-app 時代の記憶と混同しない — メモリ訂正済み） |
| AD-8 | Haiku IK-6 | engine dist の stale で偽緑 | E-24 | **採用**。単発 suite 起動時も `pnpm run ensure:workspace-dist` を前置（既存メモリ engine-dist-rebuild と一致） |
| AD-9 | Haiku IK-10 | domains → features import 禁止 | E-25 | **採用** |
| AD-10 | Sonnet FD-6 | api-contract は触らない | E-26 | **採用**。「新 route なら契約 package 更新」という一般則を**適用しない**根拠を定型文へ |
| AD-11 | Sonnet FD-5 | 許可辺 ② を fork で使わない | E-27a | **採用** |
| AD-12 | Sonnet FD-8 | action 返り値は `{error}` 規約 | E-27b | **採用**。`forkTemplate` は `createTemplate` と同形（成功 = `redirect('/templates/{newId}/edit')`・失敗 = `{ error }`） |
| AD-13 | Sonnet FD-3/FD-4/FD-9 | pin 解決は templateId 一意で version 重複は無害／Discord hub は templateName も forkedFrom も未投影／一覧は updatedAt 降順で fork 直後が上位 | uuidv4・unique index・hub-projection grep 0 件は R1 以前の実測と整合 | **採用（安心材料として記録）**。「fork のために hub-projection や version 衝突検査を触る必要はない」を out-of-scope の根拠に昇格 |
| AD-14 | Sonnet FD-7 | app.module.spec は無編集で通るが local pipe は禁止 | E-23 | **採用**。台帳 U16-c の「pipe 422 化は app.module pin が禁止」とも整合 |
| **CR-7** | Haiku BR-1/BR-2 | 「新ボタンで一覧 spec の個数 assertion が壊れる」 | E-28b — assertion は **name 指定で個数を数えていない**ため**壊れない** | **機構を訂正して採用**。壊れないことが逆に危険: テスト名『配布 Badge と作成操作**だけ**を表示する』の「だけ」は name 列挙方式ゆえ**新ボタンが増えても緑のまま**（意図の pin が不完全）。委譲時は既存 2 テストへ複製ボタンの assertion を**明示的に追記**させる |
| CR-8 | Haiku IK-8 | serviceMock「6 メソッド」 | E-28a — 実測 **7** | 数え間違いを訂正して採用（`forkSheetTemplate` の mock 追加は必要） |
| CR-9 | Haiku IK-11 | 「fork 実装が独自検証を足すと 400 が出やすくなるので remove」 | — | **半採用**。独自の構造検証を足さないのは正（YAGNI）だが、「余分な検証は remove」という一般化は不採用 — C-5 の読み取りゲートは検証であり必須 |

### 委譲プロンプト定型文への追加分（§S6 の定型文とセットで転記）

```
■ 読み取りゲートは分岐別（CR-6・最重要）
自分所有 = status 不問（draft も fork 可）。system 所有 = published のみ。
既存の resolveForCreate / resolvePinnedRevision は allowedStatuses 必須のため
これらへ寄せて実装すると「自分の draft の fork」が 409 で死ぬ。fork 専用の読み取りを書く。

■ published⇒public は DB 全体の保証ではない（CR-5）
legacy-coc は published ∧ private（seed 直接投入・規約例外コメントあり）。
fork の private 固定は「継承元の値を信用しない」独立の防御として実装する。

■ wire 形（DEC-1）
POST /sheet-templates/:id/fork・body なし・DTO は param の :id のみ。
forkedFrom.version は server が読み取った時点の version を記録する。
@UsePipes を付けない（app.module.spec の動的走査が全 controller/method/parameter の
local pipe ゼロを assert している — 付けると即赤）。

■ 触らないもの
packages/api-contract（sheet-template に wire schema は存在しない・冒頭コメントが front parse を禁止）／
hub-projection.service.ts（templateName も forkedFrom も未投影）／
characterTemplate → character の import 辺（createCharacterFromTemplate 専用）。

■ front action の形（AD-12）
forkTemplate は { error: string | null } を返し、成功時 redirect(`/templates/${newId}/edit`)。
共有 generic 型を新設しない。requireJwt() を先頭で呼ぶ（10 action 中 9 本の既存規約）。

■ テスト（AD-7・AD-8・CR-7・CR-8）
server は test:cov 通過を検収に含める（global 70/80/80/80）。単発 jest の前に ensure:workspace-dist。
controller spec の serviceMock（7 メソッド列挙）へ forkSheetTemplate: jest.fn() を追加。
TemplateListV3.spec の『…だけを表示する』系 2 テストへ複製ボタンの assertion を明示追記
（name 指定方式のため追記しないと「だけ」の pin が嘘のまま緑になる）。
```

### R2 後の残未決（変化なし＋1 件解消）

- `license` の継承規則（DQ-3）— 未決のまま
- `forkedFrom` の事後可変性（DQ-4 / C-10）— 未決のまま
- DS-8 body サイズ（DQ-2）— 低優先のまま
- ~~`sourceVersion` の運搬形~~ — **DEC-1 で解消**（wire から外す）
