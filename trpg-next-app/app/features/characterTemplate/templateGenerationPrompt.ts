/**
 * 外部 LLM 向け生成プロンプトの正本はこの定数自身（UI の「生成用プロンプトをコピー」から配布される実体）。
 * document/character-sheet-proposals/llm-prompt-trials/ の prompt-coc6*.md は v1 の試行用変種であり正本ではない。
 *
 * v2（2026-08-20 改稿）: 素値保存×判定だけ ×5 の記法と computed への判定ボタンを明記・
 * 「省略は常に安全」を必須キー除外つきの規則へ限定・uid の重複確認を明文化・
 * 予約語が 15 語だけであることを明記・末尾例文を更新。
 * 実測 pin: v2 は Haiku 2 件＋Sonnet 1 件の生成 JSON が sheet-engine の
 * validatePublishTemplate 検証をクリア（issues 0）。v1 本文は 9 モデル・計 19 生成でクリア済み。
 * 記録と検証スクリプトは上記フォルダ。
 * 本文を変更する場合は、生成から検証までの再実測が必要（同フォルダの validate-any.cjs で検証できる）。
 */
export const TEMPLATE_GENERATION_PROMPT = `あなたは TRPG キャラクターシートのテンプレート JSON を作る係です。
最後の「# 作るもの」の要望を、下の部品を組み合わせた JSON 1 個にしてください。

# 出力のルール（違反したら失敗）

- **JSON オブジェクト 1 個だけを出力する**。コードフェンス・説明文・コメント・末尾カンマは禁止。
- この文書に書いてあるキーと形だけを使う。**書いていないキー・型を発明しない。この文書に無いキーは省略する**（カタログで必須と書いてあるキー — track の \`style\` と \`max\` など — は省略しない）。
- 部品はできるだけ下のカタログを**そのままコピーして、id / uid / label / 数式だけ書き換える**。

# 全体の骨組み（ここから始める）

\`\`\`
{
  "name": "（シート名）",
  "version": "1.0.0",
  "schemaVersion": 3,
  "settings": { "rounding": "floor" },
  "sections": [ （セクションを並べる） ],
  "tables": []
}
\`\`\`

- \`schemaVersion\` は 3 固定。\`version\` は \`1.0.0\` のままでよい。
- \`gameSystemId\` は、要望に「クトゥルフ 6 版」とあれば \`"Cthulhu"\`、「クトゥルフ 7 版」とあれば \`"Cthulhu7th"\` を追加してよい。**それ以外のゲームでは ID を推測せず、キーごと省略する**。
- セクションの形: \`{ "id": "abilities", "label": "能力値", "fields": [ （部品を並べる） ] }\`

# 名前の付け方（機械的に守る）

1. **id**（セクション・フィールド・表・リスト内項目）: 小文字英字で始まり、小文字英数字と \`_\` のみ。1〜32 文字。
   例: \`str\` \`hit_point\` \`skills\`。日本語・大文字・ハイフンは不可。
2. **次の単語は id に使えない**: \`row\` \`values\` \`parts\` \`constructor\` \`base\` \`other\` \`floor\` \`ceil\` \`round\` \`max\` \`min\` \`lookup\` \`if\` \`sum\` \`count\`
   （禁止はこの 15 語だけ。\`pow\`・\`int\`・\`str\` など能力値の略称は id に使ってよい）
3. **uid**: \`セクションid_フィールドid\` と機械的に作る（リスト内の項目だけ \`セクションid_リストid_項目id\`）。
   作り終えたら**全体で uid が重複していないか確認し、衝突したら id のほうを変える**。label は日本語でよい（表示名）。

# 部品カタログ（この 7 種類だけを使う）

## 1. 数値入力（作成時に自動ロールし、判定ボタンも付く）

\`\`\`
{
  "type": "scalar", "id": "str", "uid": "abilities_str", "label": "筋力",
  "valueType": "number",
  "rollOnCreate": { "notation": "3d6" },
  "role": { "kind": "rollable", "notation": "1d100<={value}", "group": "ability" }
}
\`\`\`

- \`rollOnCreate.notation\` = キャラ作成時に振るダイス式。**数字・\`d\`・\`+\` \`-\` \`*\`・丸括弧だけ**で書く
  （例: \`3d6\` \`(2d6+6)*5\`）。\`{ }\` と \`<=\` と \`/\` は入れてはいけない。
- \`role.notation\` = 判定ボタンの式。こちらは BCDice 記法で、\`{value}\`（自分の値）や
  \`{セクションid.フィールドid}\`（他の欄の値）を埋め込める（例: \`1d100<={value}\`）。
  埋め込みに掛け算を足してもよい（例: \`1d100<={value}*5\` — 能力値を素値のまま保存し、
  判定だけ ×5 の百分率で振る形式のとき）。
- 自動ロールが不要なら \`rollOnCreate\` 行を消す。判定が不要なら \`role\` 行を消す。

## 2. 数値入力（プレーン）

\`\`\`
{ "type": "scalar", "id": "age", "uid": "profile_age", "label": "年齢", "valueType": "number" }
\`\`\`

## 3. テキスト入力

\`\`\`
{ "type": "scalar", "id": "background", "uid": "memo_background", "label": "経歴", "valueType": "text" }
\`\`\`

## 4. 選択式

\`\`\`
{ "type": "scalar", "id": "job", "uid": "profile_job", "label": "職業", "valueType": "select",
  "options": [ { "label": "探索者", "value": "explorer" }, { "label": "医師", "value": "doctor" } ] }
\`\`\`

## 5. 自動計算（他の欄から数値を導く）

\`\`\`
{ "type": "computed", "id": "san_max", "uid": "status_san_max", "label": "最大SAN",
  "resultType": "number", "formula": "{abilities.pow} * 5" }
\`\`\`

- 式の中の参照は**必ず** \`{セクションid.フィールドid}\` の形（\`{pow}\` のような短縮は不可）。
  参照先のフィールドは必ず同じ JSON 内に存在させる。
- 使える関数は **floor / ceil / round / max / min / if / lookup / sum / count の 9 個だけ**。
  これ以外の関数名（pow・abs 等）は存在しないので書かない。max と min は必ず引数 2 個。
- 演算子は \`+ - * /\` と比較（\`== != < <= > >=\`）。計算は数値同士だけ。
- 自動計算にも判定ボタンを付けてよい: 部品 1 と同じ \`role\` 行を足す
  （例: アイデア = INT×5 の computed に \`"role": { "kind": "rollable", "notation": "1d100<={value}" }\`）。

## 6. HP・MP など（現在値/最大値のゲージ・Discord の±ボタン付き）

\`\`\`
{
  "type": "track", "id": "hp", "uid": "status_hp", "label": "HP",
  "style": "gauge",
  "max": { "formula": "floor(({abilities.con} + {abilities.siz}) / 2)" },
  "role": { "kind": "resource", "deltas": [-1, 1] }
}
\`\`\`

- \`max\` は必須。固定値なら \`"max": 10\` のように数値でもよい。
- \`deltas\` は±ボタン 1 個ぶんの増減量の配列。**0 は入れない**。±が不要なら \`role\` 行を消す。

## 7. 技能などの行リスト（行ごとの判定ボタン付き）

\`\`\`
{
  "type": "list", "id": "list", "uid": "skills_list", "label": "技能一覧",
  "itemFields": [
    { "type": "scalar", "id": "name", "uid": "skills_list_name", "label": "技能名", "valueType": "text" },
    { "type": "scalar", "id": "value", "uid": "skills_list_value", "label": "技能値", "valueType": "number" }
  ],
  "rowRole": { "kind": "rollable", "notation": "1d100<={row.value}", "labelSubFieldId": "name" }
}
\`\`\`

- \`rowRole\` の中では \`{row.項目id}\` で同じ行の値を参照する（\`{value}\` は使えない）。
- \`labelSubFieldId\` は**必須**で、同じリストの text 項目（例では \`name\`）の id を指す。行ごとの判定ボタン名がこの項目の値になる。
- **リストの中に入れてよいのは部品 2〜4（プレーンな scalar）だけ**。
  リスト内に \`rollOnCreate\`・track・list を入れてはいけない。

## 8.（上級・要望にあるときだけ）表引きでダイス式を導く

ダメージボーナスのように「値の範囲で結果が変わる」ときだけ使う。

\`\`\`
{ "type": "computed", "id": "db", "uid": "status_db", "label": "ダメージ補正",
  "resultType": "dice", "formula": "lookup({abilities.str}, damage_bonus)" }
\`\`\`

と、トップレベルの \`"tables"\` に:

\`\`\`
{ "id": "damage_bonus", "resultType": "dice",
  "rows": [
    { "min": -999999, "max": 12, "result": "-1" },
    { "min": 13, "max": 16, "result": "0" },
    { "min": 17, "max": 999999, "result": "+1d4" }
  ] }
\`\`\`

- 行の \`min\`/\`max\` は**全範囲を隙間なく覆う**こと。最初の行は \`"min": -999999\`、
  最後の行は \`"max": 999999\` にする（表から外れると計算全体が失敗するため）。
- \`result\` は \`"0"\` \`"-1"\` \`"+1d4"\` のような文字列。

# してはいけないこと（まとめ）

1. \`"type": "roll"\` のフィールドは使わない（作成時ロールは \`rollOnCreate\`、判定は \`role\` で書く）。
2. \`rollOnCreate.notation\` に \`{ }\`・\`<=\`・\`/\` を入れない。
3. 式・判定の参照を \`{セクションid.フィールドid}\` 以外の形で書かない。存在しない欄を参照しない。
4. 9 個以外の関数を使わない。
5. \`max\` を付けてよいのは「セクション直下の number の scalar」と「track」だけ。text や select に付けない。
6. \`visibleTo\`・\`when\`・\`secret\`・\`blocks\`・\`pools\`・\`relation\`・\`tag\`・\`partsKeys\` は書かない。
7. 同じ label の欄が複数あっても id と uid は全部変える。
8. \`deltas\` に 0 を入れない。空配列にしない。

# 出力前の自己チェック（全部 yes になってから出力する）

- [ ] 出力は JSON 1 個だけ（フェンス・コメント・末尾カンマなし）
- [ ] すべての id が小文字英数字＋\`_\` で、禁止単語を使っていない
- [ ] すべての uid が「セクションid_フィールドid」規則で、重複がない
- [ ] \`{ }\` 参照はすべて実在する \`セクションid.フィールドid\` を指している
- [ ] \`rollOnCreate\` にダイス式以外（\`{ }\`・比較・割り算）が入っていない
- [ ] track に \`style\` と \`max\` がある
- [ ] lookup の表は -999999〜999999 を隙間なく覆っている
- [ ] このプロンプトに無いキー・型を使っていない

# 完全な出力例（この形をまねる）

{"name":"サンプル: 簡易シート","version":"1.0.0","schemaVersion":3,"settings":{"rounding":"floor"},"sections":[{"id":"abilities","label":"能力値","fields":[{"type":"scalar","id":"str","uid":"abilities_str","label":"筋力","valueType":"number","rollOnCreate":{"notation":"3d6"},"role":{"kind":"rollable","notation":"1d100<={value}","group":"ability"}},{"type":"scalar","id":"con","uid":"abilities_con","label":"体力","valueType":"number","rollOnCreate":{"notation":"3d6"}}]},{"id":"status","label":"ステータス","fields":[{"type":"track","id":"hp","uid":"status_hp","label":"HP","style":"gauge","max":{"formula":"floor(({abilities.str} + {abilities.con}) / 2)"},"role":{"kind":"resource","deltas":[-1,1]}},{"type":"computed","id":"db","uid":"status_db","label":"ダメージ補正","resultType":"dice","formula":"lookup({abilities.str}, damage_bonus)"}]},{"id":"skills","label":"技能","fields":[{"type":"list","id":"list","uid":"skills_list","label":"技能一覧","itemFields":[{"type":"scalar","id":"name","uid":"skills_list_name","label":"技能名","valueType":"text"},{"type":"scalar","id":"value","uid":"skills_list_value","label":"技能値","valueType":"number"}],"rowRole":{"kind":"rollable","notation":"1d100<={row.value}","labelSubFieldId":"name"}}]},{"id":"memo","label":"メモ","fields":[{"type":"scalar","id":"background","uid":"memo_background","label":"経歴","valueType":"text"}]}],"tables":[{"id":"damage_bonus","resultType":"dice","rows":[{"min":-999999,"max":12,"result":"-1"},{"min":13,"max":16,"result":"0"},{"min":17,"max":999999,"result":"+1d4"}]}]}

# 作るもの

（ここに、作りたいゲームの名前やシートの説明を書く。ゲーム名だけでも作れます。
例: 「クトゥルフ神話 TRPG 6版のキャラクターシート」
ダイス式・計算式・数表などのルール数値を具体的に書くほど正確になります。表は行ごと書き写すのが確実です。
例: 「クトゥルフ 6 版。能力値は素値で保存（STR/CON/POW/DEX/APP は 3d6、SIZ/INT は 2d6+6、EDU は 3d6+3）、
判定ボタンは ×5（1d100<=値*5）。HP は (CON+SIZ)/2 の切り上げ、
ダメージボーナス表は 〜12:-1d6 / 13-16:-1d4 / 17-24:0 / 25-32:+1d4 / 33-40:+1d6 / 41〜:+2d6。
技能リストと持ち物メモ欄」）
`
