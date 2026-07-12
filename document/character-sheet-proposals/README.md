# キャラクターシート基盤 設計案集（案出し）

> **目的**: 「ユーザーが Web 上で Excel のように自由にキャラクターシートのベース（テンプレート）を作成・配布でき、
> CoC のダメージボーナスのような複雑な導出ステータスも表現できる」ようにするための設計案を比較検討する。
> **ここにあるのは実装計画ではなく案出し**。1 ファイル 1 案で、概要レベルに留める。
> **最終更新**: 2026-07-06

---

## ゴール（要求の整理）

1. ユーザーが Web でシートの「枠組み」（セクション・項目・計算式・ダイス）を自作できる
2. 作ったテンプレートを他ユーザーへ配布できる（公開 / 限定公開 / 非公開）
3. 複雑な導出ステータスを表現できる。試金石は CoC 7版:
   - **DEX**: 作成時に 3d6×5 をロールして決まる能力値
   - **半分値 / 5分の1値**: `floor(DEX/2)` / `floor(DEX/5)` の派生値
   - **ダメージボーナス**: STR+SIZ を**参照表**で引き、結果が「+1d4」のような**ダイス式**になる
   - **HP**: `floor((CON+SIZ)/10)` のような複数値参照＋丸め
   - **MOV**: STR/DEX/SIZ の大小比較による**条件分岐**
4. テンプレートから作ったキャラクターは、既存の Discord 連携（スレッドのロールボタン・履歴・キャラ embed）でそのまま遊べる

## 読み方（案の分類）

- **A系 = シートの表現モデル**。互いに排他で、どれか 1 つを選ぶ（または段階導入する）
- **B系 = 横断コンポーネント設計**。A系のどれを選んでも必要になる部品。A系の選択と組み合わせて読む

## 索引

| 案 | ファイル | 一言でいうと |
|----|---------|-------------|
| 調査 | [trpg-system-survey.md](trpg-system-survey.md) | **14 系統の TRPG を棚卸しし、5 セクションと AttributeValue の充足性を検証**（結論: どちらも汎用正本としては不足。構造パターン P1〜P14 を定義） |
| **設計** | [design-v1.md](design-v1.md) | **Codex との討論 2 ラウンドを経て確定した具体設計 v1**（schema v3・式エンジン・ドメイン境界・palette・Phase 分割・争点決着表・討論記録） |
| **設計** | [design-v1-ui.md](design-v1-ui.md) | **UI 三面設計（エディタ／作成フォーム／Discord hub）を同討論プロトコルで確定**（DiscordProjectionViewModel 正本化・署名付き roll proof・ephemeral パネル・決着表 U1〜U13） |
| **監査** | [field-sufficiency-audit.md](field-sufficiency-audit.md) | **schema v3 の充足性再精査**（52 エージェント×約40システム＋Codex レッドチーム）。真ギャップ 4＋復活 4 を確定し design-v1 **v1.2** へ反映（TrackField min/resetTo・notation 文法 §2.1・明文化 §2.2・when/declare 予約） |
| 参照 | [encoding-cookbook.md](encoding-cookbook.md) | **エンコード集** — 「書けないのでは」37 主張の正準エンコード（破れ 4 件は注記）＋非自明レシピ 79 件。テンプレート作者/実装者向けリファレンス |
| A1 | [a1-extend-current-sections.md](a1-extend-current-sections.md) | 現行 AttributeSection（5セクション）を温存し formula を足す最小変更案 |
| A2 | [a2-schema-driven-fields.md](a2-schema-driven-fields.md) | フロントの characterTemplate DSL をサーバー正本に昇格するスキーマ駆動案（本命候補） |
| A3 | [a3-spreadsheet-cells.md](a3-spreadsheet-cells.md) | セル参照＋自由グリッドの「Excel そのもの」案 |
| A4 | [a4-typed-blocks.md](a4-typed-blocks.md) | 意味付きブロック（能力値/技能/リソース/参照表）を組み合わせる案 |
| B1 | [b1-formula-engine.md](b1-formula-engine.md) | 式・導出エンジン（参照表 LOOKUP・ダイス値型・条件・安全な評価器） |
| B2 | [b2-domain-boundaries.md](b2-domain-boundaries.md) | ドメイン境界（character-sheet ドメイン新設と character ドメイン再設計） |
| B3 | [b3-distribution-sharing.md](b3-distribution-sharing.md) | 配布・共有（公開範囲・版管理・fork・ギャラリー・安全性） |
| B4 | [b4-discord-mapping.md](b4-discord-mapping.md) | Discord 連携マッピング（ロール注釈→ボタン/チャットパレット自動生成） |
| C1 | [c1-outcome-effects.md](c1-outcome-effects.md) | **結果連動エフェクト**（判定→成功/失敗分岐→SAN/HP/MP 自動増減→undo）＋先行スライス **Apply Roll Result**（ロール結果メッセージの右クリック→リソース適用）。design-v1 の v1.x 拡張候補（R4/R5 討論・2026-07-07 骨子合意） |

## A系 比較早見表

| 観点 | A1 温存拡張 | A2 スキーマ駆動 | A3 スプレッドシート | A4 ブロック合成 |
|------|------------|----------------|-------------------|----------------|
| 表現の自由度（Excel 度） | 低 | 中〜高 | 最高 | 中 |
| CoC ダメージボーナス | 式関数の後付けで可能だが苦しい | B1 拡張が前提で可能 | 自然に可能 | 参照表ブロックで最も素直 |
| character ドメイン移行コスト | ほぼゼロ | 中〜大 | 大 | 中〜大 |
| Discord 連携との適合 | 無改修で動く | 注釈＋実体化が必要（B4） | 注釈層が必須（最難） | 仕様レベルで自然に決まる |
| エディタ実装量 | 小 | 中（mock 資産あり） | 大 | 中〜大 |
| 配布物の単位 | セクション雛形 JSON | テンプレート JSON（fields+layout） | シートファイル | ブロック定義集 |

## 現時点の所感（決定ではない）

- 本命は **A2 ＋ B1〜B4 の組み合わせ**。フロントに式エンジン・エディタ・ギャラリーの mock 資産が既にあり
  （`trpg-remix-app/app/features/characterTemplate/`）、「Excel のように」の体感（式・レイアウト・型付き項目）と
  Discord 連携の折り合いが最も取りやすい。
- **A1 は A2 への第一増分**として価値がある（テンプレート pin と formula 追加だけ先行し、既存経路を無傷に保つ）。
- **A4 は単独案というより A2 に「フィールドの意味役割（role）」として取り込む**のが現実的（詳細は B4）。
  特に技能リスト・リソース・参照表の 3 ブロックは A2 の弱点を埋める。
- **A3 は現時点では採らない想定**だが、「Excel のように」という要求の原点として、他案で何を犠牲にしているかを
  測る基準として記録しておく。
- **システム横断調査（[trpg-system-survey.md](trpg-system-survey.md)・2026-07-06）の反映**:
  5 セクションも AttributeValue も汎用正本としては不足が確定（調査の結論参照）。A1 の位置づけは
  「第一増分・CoC 系専用」に限定し、A2 はフィールド型に list(repeater) / track / relation / tag を足す前提
  （＝実質 A2＋A4 融合が本命）。現行 5 セクションは B2 の「Discord 向け materialized view」としてのみ存続させる。
- **具体設計は [design-v1.md](design-v1.md) で確定（2026-07-06・Codex 討論 2 ラウンド、確定宣言「可」）**。
  以後の設計変更は design-v1 の改版（v1.x）として管理する。A/B 各案ドキュメントは決定の経緯資料として凍結。
- **UI 三面設計も [design-v1-ui.md](design-v1-ui.md) で確定（2026-07-07・同プロトコル、確定宣言「可」）**。
  鍵は `DiscordProjectionViewModel` の正本化 —— エディタの Discord プレビューと実機が同一の純 TS 算出を読む
  ことで「プレビュー＝実機」を CI（golden fixture）で保証する。
- **フィールド型の充足性は [field-sufficiency-audit.md](field-sufficiency-audit.md)（2026-07-07）で再精査済み**。
  約 40 システムの総当たり＋敵対的反証＋Codex レッドチームの結果、**型セットはほぼ充足**（型追加ゼロ・
  TrackField への min/resetTo 追加と仕様明文化のみ）と確定し、design-v1 は **v1.2** に改版。
  「書けないのでは」への回答集は [encoding-cookbook.md](encoding-cookbook.md)。

## 共通の前提・制約（どの案でも守る）

- 依存方向 `features → domains → core → shared`・循環依存ゼロ・`@Global`/`forwardRef` 禁止（`TRPG-SERVER/src/ARCHITECTURE.md`）
- `characterId` は不変。属性の現行正本型は `core/types/attribute.types.ts`（変更する案は、その変更自体を設計対象として明示する）
- 新しい書き込み経路は必ず DTO(class-validator) / Zod を通す（DB 層にセクションのスキーマ検証はない）
- リポジトリの読み取りは projection 明示列挙（S-1 の教訓）。モデル拡張時は関係する全 `.select(...)` と repository spec を更新する
- ドメイン間のイベント RPC は禁止（DI で直接呼ぶ）。通知目的の event 発行・購読は可
- Discord でのロール実行の正本は bcdice。フロントのプレビュー用ローラーと二重化する場合は責務を分ける
- 式・参照表は「データ」であり「コード」ではない（`eval` 禁止・専用評価器。`characterTemplate/AI.security.md` の方針を継承）

## 主な未決事項（案の選定後に決める）

> **決着状況（2026-07-06・design-v1 討論）**: **1〜4・6・9 は決着**（[design-v1.md](design-v1.md) §8 決着表）。
> 7・8 は部分決着（relation は Phase 3 で採用、リセットは明示操作と決定。共有シート P14 と発火権限が未決）。
> **5（未認証閲覧）は完全未決**（Phase 4 論点）。加えて討論で持ち越しになった新規未決: GM/セッション権限モデル、
> SW 威力表型（多入力・振り足し）lookup 拡張、通報・license 運用。

1. ロール値の正本エンジン（bcdice / フロント簡易ローラー / 両対応時の境界線）
2. フィールド参照の構文（flat な `{dex}` か、区画付き `{parameter.dex}` か）
3. 公開済みテンプレートの不変性（published version の編集を許すか）
4. 既存キャラクターの移行（暗黙の「現行 CoC シート」を legacy テンプレートとして切り出すか）
5. 公開ギャラリーの未認証閲覧可否（現状の API はほぼ全て JwtAuthGuard 付き）
6. per-viewer 秘匿スコープ（public / owner / GM）をどの段階で入れるか — GM ロール概念の導入が前提（調査 P10）
7. キャラ間関係（ロイス/絆）・共有シート（国/ギルド）を初期スコープに含めるか（調査 P7 / P14）
8. 回数リソースのリセット語彙（シーン / セッション / 休息）を誰が発火するか（調査 P11）
9. 特技表グリッド（シノビガミ系）を専用ブロックとして開発するか（調査 P6）
10. 個別 list 行の選択参照（selectedRow / relation-to-row）— プレイヤーが任意数の行を作って選択する構造の v1.x 拡張（監査 R10）
11. Discord からの boolean トグル（toggle role / set 意味論）— v1 は「切替は Web のみ」（監査 R31）
12. relation 先フィールドの live 参照 — v1 は手動転記・非対応明記（監査 R33。P14 と同系）
13. `resetTo` formula からの自 track 現在値参照（FATE 型「現在値と refresh の高い方」持ち越し。監査 G28）
14. `kind:'declare'`（ロールなし宣言アクション）の v1.x 採用案 — label＋textRefs→plain 投稿、`dec_` prefix は予約済み（監査 G35）
15. 作者ピン留めフラグの schema v3 追加 — design-v1-ui の hub「作者ピン留めボタン」に対応するフィールド属性が schema v3 に存在せず、Phase 2 実装は**先頭 20 ロールへの縮退**で出荷（PH-6b 開示制約。[phase2-ph7-acceptance-checklist.md](phase2-ph7-acceptance-checklist.md) §7-1）

## 関連する既存資産

- [document/phase0-character-sheet.md](../phase0-character-sheet.md) … Phase 0 設計（`CharacterSheetTemplate` 型の初案 §4.1.3、description/式の二重用リスク §5）
- `trpg-remix-app/app/features/characterTemplate/AI.{feature,types,ui,api,security}.md` … フロント DSL（schemaVersion 2）と式エンジン仕様
- `trpg-remix-app/app/routes/mock.template-editor.tsx` / `mock.template-gallery.tsx` … エディタ / ギャラリーの mock 実装
- `TRPG-SERVER/src/core/types/attribute.types.ts` … AttributeValue / AttributeSection（現行の正本）
- `TRPG-SERVER/src/domains/character/` … character ドメイン（設計ガイド: `.claude/skills/trpg-domain-character/SKILL.md`）
- `TRPG-SERVER/docs/reviews/feature-inventory-2026-06-05.md` … 実コード根拠の機能棚卸し（Discord 側の消費実態）
