# キャラシ JSON 生成プロンプトの LLM 比較

固定プロンプトを Cursor の各モデルへ投げ、クトゥルフ 6 版テンプレを保存可能な JSON にできるかを見る。

> **正本について（2026-08-20）**: プロンプト本文の正本はコード内定数
> `trpg-next-app/app/features/characterTemplate/templateGenerationPrompt.ts`（UI の
> 「生成用プロンプトをコピー」から配布される実体）。このフォルダの `prompt-coc6*.md` は
> 試行用の変種であり正本ではない。カタログ部（`# 作るもの` より前）は両変種とも定数と
> byte 一致することを 2026-08-20 に機械照合済み。本文を変更する場合は生成→検証の再実測が必要。

## 投げ方

1. Cursor で新しいチャットを開き、モデルを切り替える
2. `prompt-coc6.md` をそのまま貼る（説明を足さない）
3. 出力が JSON 1 個なら `coc6-<model>.json` としてこのフォルダへ保存する
4. テンプレ一覧の「JSON から作成」へ貼って保存できるかを見る
5. 任意: `node validate-coc6.js coc6-<model>.json` で engine 検証（要 `packages/sheet-engine` の build）
6. 一括: `node --experimental-strip-types validate-all-trials.ts`（同条件）

## 比較の観点

- フェンス・説明文なしで JSON だけ出せたか
- `gameSystemId` が `Cthulhu` か
- 禁止キー（`parts` / `layout` / `visibleTo` など）を足していないか
- uid が `セクションid_フィールドid` か
- HP / MP / SAN / DB / 技能リストが揃っているか
- アプリへ貼って 400 にならないか

## 2026-08-20 Cursor サブエージェント比較

同じ `prompt-coc6.md` を 7 モデルへ並列委譲。コードベース参照は禁止。検証は `validatePublishTemplate`。

| モデル | 成果物 | JSON のみ | publish | DB 表 |
|---|---|---|---|---|
| Claude 4 Sonnet | `coc6-claude-4-sonnet.json` | 失敗（要約に潰れた。ファイル書き出しで回収） | OK | 3d6 スケール（*5 ではない） |
| Claude Opus 5 | `coc6-claude-opus-5.json` | OK | OK | 6版*5 に近いが `+1d6` で打ち切り |
| Composer 2.5 Fast | `coc6-composer-2.5-fast.json` | OK | OK | 7版レンジ + 先頭が `-2`/`-1` |
| Grok 4.5 | `coc6-grok-4.5.json` | OK | OK | 7版レンジ + 6版ダイス、`D` が大文字 |
| Grok 4.6 | `coc6-cursor-grok-4.6.json` | OK | OK | 7版レンジ + 6版ダイス、`+6d6` まで |
| Gemini 3.1 Pro | `coc6-gemini-3.1-pro.json` | OK | OK | 7版レンジ + 6版ダイス、`+3d6` で打ち切り |
| GPT 5.6 | `coc6-gpt-5.6.json` | OK | OK | 7版レンジ + 6版ダイス。`pow`/`int` を避け `pow_stat`/`int_stat` にした |

結論: **スキーマとしては全モデルが通る。** 差は主にダメージボーナス表のルール知識と、予約語の過剰回避。

プロンプト改善の候補:

- 「作るもの」に 6 版 *5 の DB 表をそのまま載せる（モデル知識に頼らない）
- `pow` / `int` は id として使ってよい、と明記する（関数名との混同防止）
- サブエージェント経由だと JSON のみ出力が要約レイヤで消えることがある（Sonnet）

## 2026-08-20 ブラインド（CoC ルールは渡さない）

「作るもの」は `クトゥルフ 6 版の探索者シート。` だけ。公式・能力値一覧は渡していない。正本は `prompt-coc6-blind.md`。

| 強さ | モデル | 成果物 | publish | 能力値の置き方 | 目立つ点 |
|---|---|---|---|---|---|
| 強 | Claude Opus 5 | `blind-coc6-opus.json` | OK | 3〜18（3d6 / 2d6+6 / 3d6+3） | 6版の職業技能点・武器欄まで自力で足した。DB 表も 3〜18 |
| 強 | GPT 5.6 | `blind-coc6-gpt-5.6.json` | OK | 3〜18 | HP=(CON+SIZ)/2、SAN=POW×5。DB の table id が `damage_bonus_table` |
| 中 | Gemini 3.1 Pro | `blind-coc6-gemini.json` | OK | 3〜18 | SAN 最大を 99 固定（6版ではない）。判定が `{value}*5` |
| 中 | Grok 4.6 | `blind-coc6-grok-4.6.json` | OK | 3〜18 | 職業点・趣味点・武器まで。SAN=POW×5。DB は 3〜18 |
| 中 | Claude 4 Sonnet | `blind-coc6-sonnet.json` | OK | *5 保存（3d6*5） | 日本の 6 版シートに近い。DB 表だけ 3〜18 のまま |
| 弱め | Grok 4.5 | `blind-coc6-grok-4.5.json` | OK | 3〜18 | MOV を手入力。DB に d8/d10 が混ざる |
| 弱 | Composer 2.5 Fast | `blind-coc6-composer.json` | OK | *5 保存なのに HP は /2 | 7版の MOV / Build が混入。MP は POW/5 |

結論: **ルールを書かなくても JSON は通る。** ただしモデルは「3〜18 の原書 6 版」と「日本の *5 保存」を混ぜ、弱いモデルは 7 版も混ぜる。カタログ例（`3d6` と HP の `/2`）が 3〜18 側に引っ張る。

## 2026-08-19〜20 Claude Code Agent 経由の実測（J2 検収時。`cc-` 付き）

Claude Code の Agent tool（モデル指定 `haiku` / `sonnet`。当時の既定解決に依存し正確な版は未記録）へ
同じカタログ部のプロンプトを渡した出力。検証は `validate-any.cjs`（validatePublishTemplate＋standalone 記法）で全件 issues/warnings 0。

| 成果物 | モデル | 要望 | 備考 |
|---|---|---|---|
| `coc6-cc-haiku.json` | Haiku | 詳細（CoC6 の *5 ルール数値付き） | `validate-all-trials.ts` の glob 対象 |
| `school-trpg-cc-haiku.json` | Haiku | 詳細（学園もの・非 CoC） | CoC 検算スクリプトの対象外 |
| `blind-coc6-cc-haiku.json` | Haiku | ゲーム名のみ | 末尾例文からルール数値を除去した変種プロンプト使用 |
| `blind-coc6-cc-sonnet.json` | Sonnet | ゲーム名のみ | 同上 |

この 4 件＋上記 Cursor 15 件の計 19 出力（9 モデル）が engine 検証クリア。コード内定数の Why コメントが参照する実測 pin の記録はこのフォルダ。

## 2026-08-20 プロンプト v2（改稿と再実測。`v2-` 付き）

コード内定数（正本）を v2 へ改稿。変更 5 点: ①素値保存×判定だけ ×5 の記法（`1d100<={value}*5`）と
computed への判定ボタンを明記（いあきゃら型を生成可能に） ②「省略は常に安全」を必須キー除外つきへ限定
③uid の重複確認を明文化 ④予約語が 15 語だけであることを明記（pow/int の過剰回避防止）
⑤末尾例文を更新（数表は行ごと書き写す助言つき）。①④⑤は v1 実測の知見、②③は J2 レビュー所見の消化。

再実測（Claude Code Agent 経由・検証は `validate-any.cjs`・全件 issues/warnings 0）:

| 成果物 | モデル | 要望 | 結果 |
|---|---|---|---|
| `v2-coc6-iachara-cc-haiku.json` | Haiku | いあきゃら型 CoC6 詳細（素値保存・×5 判定・数表行ごと指定） | 素値×5 判定 8/8・computed 判定ボタン・SAN max 99・HP ceil まで要望どおり |
| `v2-school-trpg-cc-haiku.json` | Haiku | 学園もの詳細（v1 と同系の回帰） | 準拠 |
| `v2-blind-coc6-cc-sonnet.json` | Sonnet | ゲーム名のみ | 準拠。自発的にいあきゃら型を選択（SAN max は min(POW*5, 99)）。DB 表はカタログ例の流用でルール知識は v1 同様に要望依存 |

計測ハーネスの注意 2 点: プロンプト組み立てで「# 作るもの」を indexOf で切ると**本文 2 行目の
自己参照に先当たりして断片だけ渡る**（`\n# 作るもの\n` の行頭アンカーで切ること。断片が渡ると
モデルは自由 JSON を発明する）。サブエージェントの結果通知は `<` を HTML エスケープ表示するため、
測定値はエージェント自身にファイル書き出しさせた実バイトで判定する。

## このフォルダのファイル

| ファイル | 内容 |
|---|---|
| `prompt-coc6.md` | 元プロンプト + 詳細な「作るもの」（ルール付き） |
| `prompt-coc6-blind.md` | 同じプロンプト。「作るもの」はゲーム名だけ |
| `coc6-request.md` | 詳細な「作るもの」だけ |
| `blind-coc6-*.json` | ブラインド比較の出力 |
| `coc6-grok-4.6.json` | 以前の Grok 4.6 出力（エンジン検証済み） |
| `coc6-cursor-grok-4.6.json` | 2026-08-20 サブエージェントの Grok 4.6 |
| `validate-coc6.js` | `validatePublishTemplate` + HP/MP/SAN/DB 検算 |
| `validate-all-trials.ts` | `coc6-*.json` 一括検証 |
| `*-cc-*.json` | Claude Code Agent 経由の実測（v1 4 件＋`v2-` 3 件。上表） |
| `validate-any.cjs` | ゲーム非依存の単発検証（保存時検証＋standalone 記法。`node validate-any.cjs <file>`） |
