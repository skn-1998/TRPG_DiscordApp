# フィールド型充足性監査 — schema v3 は本当に足りているかの再精査

> **分類**: 監査（[design-v1.md](design-v1.md) §1-§2 フィールド型セットの再検証）
> **ステータス**: **確定** — 多エージェント監査 → Codex レッドチーム検証（判定「不可＋条件」）→ 全条件を v1.2 へ反映 →
> Codex 最終確認で**裏取り 7/7 充足・残指摘なし・確定宣言「可」**（2026-07-07）。
> **方法**: 多エージェント・ワークフロー（52 エージェント）＝ 7 クラスタ＋補完 3 ファミリの約 40 システムで
> エンコード総当たり → 重複排除 → **ギャップ主張ごとに敵対的反証** → 統合 → **Codex による監査結果自体のレッドチーム検証**
> **最終更新**: 2026-07-07

---

## 結論サマリ

**155 件の指摘 → 41 件の一意ギャップ主張 → 敵対的反証で 37 件が「エンコード可能」→ 真のギャップ 4 件。
さらに Codex レッドチームが反証 4 件（R10/R25/R31/R33）を破り、最終形は「真のギャップ 4＋復活 4」。**

- schema v3 の型セットは**型の品揃えとしてはほぼ足りている**。型追加はゼロ、フィールド追加は
  TrackField の `min` / `resetTo` の 2 つ（いずれも v1.2 反映済み）。
- 「仕様の未規定」が最大のリスク源だった。特に **G02（notation 差し込み文法）は CoC 武器ダメージ合成が
  依存する release-blocking** で、インジェクション面も含めて design-v1 **§2.1** として確定した。
- エンコード可能と確定した主張は [encoding-cookbook.md](encoding-cookbook.md) に回収
  （37 件の正準エンコード〔うち破れ 4 件は注記つき〕＋非自明レシピ 79 件）。

## 確定ギャップ（4 件）と v1.2 での反映

| # | ギャップ | 処置 | v1.2 反映先 |
|---|---------|------|------------|
| G28 | TrackField `resetOn` の復元先が未定義 | **must-fix** | design-v1 §1: `resetTo: 'zero'\|'max'\|{formula}`（style 別既定）＋ **reset＝parts を `{base:値}` へ置換する冪等な上書き**・スコープ・権限・自 track 現在値参照不可（FATE 型持ち越しは README 未決） |
| G02 | role notation の差し込み文法が未規定 | **spec-clarify（release-blocking）** | design-v1 **§2.1**: 許可トークン／rowRole の `{value}` 拒否／`{{ }}` エスケープ／**fragment 型による注入防止（自由入力 text の参照は publish エラー）**／符号正規化／resolvedRefs 解決／**補間後 notation の bcdice parse 検証（失敗はエラー状態・黙って公開しない）** |
| G34 | role の有効化条件（palette 生成ゲート）が無い | defer＋予約 | design-v1 §1 FieldBase: `when?` を**名前と採用時意味論ごと予約**・v1 publish は明示拒否・**「状態依存のボタン無効化（ネクロニカ破損パーツ）は v1 非対応」を明記** |
| G35 | 宣言型アクション（`kind:'declare'`）が無い | defer＋予約 | design-v1 §4: kind 拡張規約（**publish は既知 kind のみ受理／runtime は未知 kind 無視**の二分）＋ `dec_`・`chk_`（案C1）プレフィックス予約＋ key 文字種 `[a-z0-9]` 限定によるパース安全化 |

## レッドチームで復活したギャップ（4 件）

一次監査で「反証済み」とした 37 件のうち、Codex の攻撃で反証が破れたもの。

| # | 復活したギャップ | 破れた理由 | 処置 |
|---|----------------|-----------|------|
| R25 | TrackField の値域・クランプ未規定 | scalar 迂回は「基本意味論の穴」の反証にならない | **v1.2 で解消** — `min` 追加＋クランプ仕様（± の delta は境界で切り詰め、実効 delta を parts.other へ） |
| R10 | 個別 list 行の選択参照（selectedRow / relation-to-row） | フラグ反転は固定小規模枠のみ。published 不変テンプレート上でプレイヤーが任意数の行を作る用途では事前列挙が破綻 | **明示 deferral** — v1.x 拡張候補として README 未決へ。cookbook の当該レシピに適用範囲注記 |
| R31 | Discord からの boolean トグル（成長チェック） | ±1 raw＋computed は連打で壊れる（raw≥2 で解除不能） | **明示 deferral** — toggle role / set 意味論を v1.x 予約。v1 は「切替は Web のみ・Discord は表示のみ」 |
| R33 | relation 先フィールドの live 参照 | 外部同期 scalar は手動転記であり silent stale を生む | **明示 deferral** — 「live 参照は非対応（手動転記）」を design-v1 §2.2-10 に明記。P14 系の将来論点 |

## 仕様明文化 → design-v1 §2.1 / §2.2 へ反映済み

一次監査の 16 件を Codex 指摘で修正・統合し、**§2.1（notation 文法）＋ §2.2（12 件）**として確定した。主な修正:

- 「DiceExpr」の語を **notation fragment** に分離（式の dice 値型＝算術混入不可、との混線を防止）
- RelationField attrs は「スカラー限定」に**決定**（二択のままでは Zod 正本にできないため）
- itemFields 内 RollField は「v1 は publish 拒否・手入力が正」に**決定**
- reset の冪等性・parts 正規化・行追加後の扱い・権限境界を G28 側へ統合
- 追加: track 値域クランプ（R25）・unknown kind の publish/runtime 二分・brace エスケープ・補間後 parse 検証・
  rowRole と subfield role の並存規則（別エントリ・label 合成規約）

## 既知 deferral の再確認（すべて「v1 を壊さない」ことを個別確認）

- **GridBlock（P6）**: シノビガミ特技は平坦 66 択 select＋rowRole で v1 成立。grid の正当な残要求は「ギャップ距離の自動算出」のみ
- **GM/秘匿凍結**: 秘匿中核システム（パラノイア・インセイン）でもシート「構造」は全て置ける（隠せないだけ）。配布ガイドで期待値管理
- **P14（共有・下位実体）**: 固定 1 機体はセクション分割で収まる。「複数保有・乗り換え・共有」が要件化した時点で P14、の境界を確認
- **SW 威力表**: 卓ロールは bcdice K コマンド委譲（`K{row.power}@{row.crit}+{row.mod}`）で成立。**§2.1 の複数参照文法が前提**（充足済み）
- **リセット発火権限**: 明示操作で成立（復元先の意味論 G28 は分離して must-fix 済み）
- **P12（選択駆動）**: PbtA は「1 プレイブック＝1 テンプレート」分割＋fork で成立
- **[c1-outcome-effects.md](c1-outcome-effects.md) へ接続**: CoC7 プッシュロール・ロール結果→値の自動書き戻し（DX3 バックトラック等）は v1 手動運用で成立し、c1 が正しい受け皿
- 相互参照の整合: v1 は片方向参照＋手動整合。相互性保証はドメイン論点のまま
- 未認証閲覧・通報・license: フィールド型側からの反例なし

## 網羅性

- 一次 7 クラスタ（サイフィク／FEAR 系クラス制／海外 d20／海外ナラティブ／シミュ・ポイントビルド／BRP 再点検／特殊構造）
  ＋批評家指摘の補完 3 ファミリ（年代記・トループ制／ジャーナリング・喪失駆動／スロット占有インベントリ）
- 検討して除外: WoD/Storyteller・Traveller ライフパス・Lancer 機体分離・Year Zero 系・Cortex Prime
  （いずれも P1〜P14 の既知パターンの組合せで新種なし、と判定根拠つきで記録）

## 討論記録（多エージェント監査＋Codex レッドチーム・2026-07-07）

- **一次監査**: ワークフロー 52 エージェント。155 指摘 → 41 一意ギャップ → 敵対的反証（「迷ったらエンコード可能に倒す」
  規則で偽ギャップを排除）→ 生存 4。
- **Codex レッドチーム**（新規スレッド・読み取りのみ）: 判定「**不可＋条件**」。
  - G28/G02 は方向妥当だが粒度不足（parts 上書き規則・インジェクション面・補間後検証）→ **受諾し v1.2 で規定**
  - G34 は「defer するなら非対応と明記、入れるなら意味論定義」→ **defer＋予約意味論の完全定義＋非対応明記**で決着
  - G35 は妥当・kind open enum の同時導入が条件 → **publish/runtime 二分規約として反映**
  - エンコード攻撃 9 件中 **4 件が破れ**（R10/R25/R31/R33 → 上表）、5 件は耐えた（R01/R02/R04/R29/R36。
    うち R01/R02/R04 は §2.2 の明文化が成立条件＝反映済み）
  - kind/customId 名前空間: `chk_` 予約・`c1_` の不使用・key 文字種限定 → **反映**
  - E-6 整合メモの事実誤認（E-6 は完了済み）→ **修正**（下記）
- **条件充足の対応表**: (a) G28/G02 の実装可能粒度化 → design-v1 §1・§2.1 ／ (b) kind/customId 整合 → §4 ／
  (c) R10/R25/R31/R33 の復活処置 → 本書＋cookbook 注記＋README 未決 ／ (d) E-6 事実更新 → 本書＋design-v1 §3/§5。
- **最終確定宣言**（Codex 確認ラウンド・2026-07-07）: 反映 1〜7 の裏取り**すべて充足**・残指摘**なし**・
  「**可。design-v1 v1.2＋監査文書を確定としてよい**」。

## 別件リファクタ（E-6 系列）との整合 — **全スライス実施済み（2026-07-07 時点の git log で確認）**

[refactor-entity-boundary-plan-2026-07-07.md](../../TRPG-SERVER/docs/refactor/refactor-entity-boundary-plan-2026-07-07.md) の
E-6a〜E-6e は**コミット済み**（04e0b5b / 6484123 / 3f83923 / a8c347e / 199b5e6）。本設計への帰結:

- **E-6a（threadId 撤去・済）**: design-v1 §3 の「discordThreadId 一本化」は**達成済みの前提**になった（本設計では何もしない）
- **E-6d（CharacterEntity 公開型・済）**: Phase 2 の Character 拡張（sheet/computedCache/palette）は
  **CharacterEntity（公開 plain 型）と @Schema（persistence 専用）の両方**へ追加し、repository 境界の plain 化契約に従う
- **E-6e（BCDice 実行コアの domains/dice-roll 引き上げ・済）**: `/sheet-rolls` API（U2）・rollOnCreate・
  c1 の RollActionExecutor は**抽出済みの実行コアを再利用**する（二重実装しない）。REST ダイス API の新設は
  roadmap 側の判断事項のまま
- **E-6b/c（controller の §9 準拠化・ゴースト解体・済）**: domains 層のイベント発行はゼロになったため、
  design-v1 §5 の「インスタンス化・連携トリガーは features 層」という方針の**前提が既に成立**している
