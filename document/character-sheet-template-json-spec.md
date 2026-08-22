# キャラクターシートテンプレート 受理 JSON 仕様（schemaVersion 3）

作成: 2026-08-19。現ワーキングツリーの実装（PV-S 系コミット `4ec72186`/`e848ba16` 適用後）から
検証コードを直接読んで起こした仕様。**「何を受け付け、何を拒否するか」の正本はコード**であり、
本 doc はその写しである。齟齬を見つけたらコードを正とし本 doc を直すこと。

| 検証の正本 | 場所 |
|---|---|
| 構造スキーマ・publish 検証 | `packages/sheet-engine/src/publish.ts`（`validatePublishTemplate`） |
| standalone roll 文法 | `packages/sheet-engine/src/standalone-roll.ts` |
| 式パーサー | `packages/sheet-engine/src/parser.ts` |
| 参照解決 | `packages/sheet-engine/src/template-index.ts` |
| HTTP DTO | `TRPG-SERVER/src/domains/character-sheet-template/dto/*.dto.ts` |
| 永続化境界 zod | `packages/api-contract/src/character-sheet-template/character-sheet-template.zod.ts` |
| publish 追加ステージ | `TRPG-SERVER/.../validation/template-publish-validation-issue.collector.ts` |

---

## 1. 検証の全体像 — 3 つの層と 2 つのタイミング

テンプレート JSON は 1 箇所で検証されるのではなく、**層ごとに受理範囲が狭まる**。
この形の JSON を UI から直接投入する導線として、テンプレート一覧の
「**JSON から作成**」（貼り付けモーダル・2026-08-19 追加）がある。貼り付け時の client 検査は
「JSON として読めるか・オブジェクトか・name 非空か」の 3 点だけで、構造検証は下記②が正本
（`trpg-next-app/.../utils/v3Template.ts` の `parseTemplateImportJson`）。
同モーダルには外部 LLM 向け生成プロンプトのコピー導線（2026-08-20 追加）があり、その正本は
コード内定数 `trpg-next-app/.../characterTemplate/templateGenerationPrompt.ts`
（実測記録は `document/character-sheet-proposals/llm-prompt-trials/`）。

```
POST /sheet-templates          PUT /sheet-templates/:id       POST /sheet-templates/:id/publish
        │                              │                              │
   ┌────▼──────────────────────────────▼────┐                        │
   │ ① HTTP DTO 層（class-validator）        │                        │
   │   トップレベルキーの型だけ。            │                        │
   │   sections / tables の中身は素通し      │                        │
   └────┬──────────────────────────────┬────┘                        │
   ┌────▼──────────────────────────────▼────┐                        │
   │ ② 保存時検証（create / draft 更新共通） │                        │
   │   a. entity zod（semver・schemaVersion） │                        │
   │   b. engine validatePublishTemplate     │                        │
   │      → issues 1 件でも 400 で保存拒否   │                        │
   └─────────────────────────────────────────┘                        │
                                                            ┌────────▼────────┐
                                                            │ ③ publish 追加   │
                                                            │  ・visibility=public
                                                            │  ・engine 再検証  │
                                                            │  ・standalone-notation
                                                            │  ・projection-key │
                                                            └─────────────────┘
```

重要な性質:

- **draft でも engine 検証は通る形しか保存できない**。`validateForSave` は publish と同じ
  `validatePublishTemplate` を呼び、issue が 1 件でもあれば 400（warning は保存を止めない）。
- **未知キーは拒否されず保持される**（engine スキーマはほぼ全域 `.passthrough()`）。
  「知らないキーを書いても通る」は仕様であり、将来の互換のため意図的。ただし
  `max` / `partsKeys` だけは対象外の型に書くと明示拒否される（§6.1）。
- publish だけで拒否されるもの（draft 保存は通る）: roll 型 notation の standalone 文法違反、
  投影キー衝突、visibility ≠ public。

エラー応答は 400 で `"path: message"` 形式の文字列配列（例:
`"sections.abilities.str.max: scalar max is only supported on section-level number scalar fields"`）。

---

## 2. トップレベル構造

### 2.1 クライアントが送れるキー（create / draft 更新の body）

```jsonc
{
  "name": "オリジナルシート",           // create では必須・非空文字列
  "version": "1.0.0",                  // 省略時 "0.1.0"。semver 必須（例: 1.0.0 / 1.0.0-beta.1）
  "schemaVersion": 3,                  // 省略可。指定するなら 3 のみ（それ以外は 400）
  "gameSystemId": "Cthulhu",           // 省略可。BCDice のシステム ID。未知 ID でも保存は通るが
                                       // 作成時ロールが失敗するので実在 ID を推奨
  "tags": ["coc", "6版"],              // 省略時 []。文字列配列（動作には影響しない）
  "visibility": "private",             // private | unlisted | public（省略時 private）
  "forkedFrom": {                      // 省略可。複製元の記録
    "templateId": "…", "version": "1.0.0"
  },
  "license": "CC-BY-4.0",              // 省略可。非空文字列
  "sections": [ /* §4 */ ],            // 省略時 []
  "tables": [ /* §9 */ ],              // 省略時 []
  "settings": { "rounding": "floor" }  // rounding: floor | ceil | round（省略時 floor）
}
```

### 2.2 サーバーが管理するキー（body に書いても採用されない／書けない）

| キー | 決め方 |
|---|---|
| `templateId` | サーバーが UUID v4 で採番 |
| `status` | `draft` → publish で `published` → 削除で `deprecated` |
| `authorDiscordUserId` | JWT の本人 |
| `draftRevision` | 楽観ロック番号。**draft の PUT では現在値の送信が必須**（不一致は 409） |
| `publishedAt` / `createdAt` / `updatedAt` | サーバー付与 |

### 2.3 ライフサイクルによる更新制約

- **draft**: 全キー更新可。`draftRevision` 必須（自動保存の競合検出）。
- **published / deprecated**: 構造は不変。`name` と `tags` **だけ**更新可。
  それ以外のキー（`version`・`sections`・`settings` 等）が 1 つでも body にあると 409。
- fork（`POST /:id/fork`）: body なし。名前 `{元名} のコピー`・visibility は強制 private・
  `forkedFrom` はサーバーが記録する。

---

## 3. 命名規則（id / uid / label）

テンプレート内のあらゆる「内部識別子」に共通で適用される。

### 3.1 id — `^[a-z][a-z0-9_]{0,31}$`

- 対象: `section.id`・`field.id`（list の itemFields・relation の attrs も再帰的に）・
  `table.id`・`block.id`・`pool.id`・`partsKey.id`
- 小文字英字始まり・小文字英数字とアンダースコア・最大 32 文字
- **予約語は拒否**: `row` `values` `parts` `constructor` `base` `other`
  `floor` `ceil` `round` `max` `min` `lookup` `if` `sum` `count`
- 一意性: table id は tables 内 / block・pool id は section 内 / partsKey id は field 内で一意

### 3.2 uid — テンプレート全体で一意な不変キー

- 1〜128 文字。`__proto__` `constructor` `prototype` は拒否（prototype 汚染封止）
- **テンプレート全体で一意**（重複は拒否）。値の保存キーとして使われるため、
  id と違って後から変えると保存済みシートの値が読めなくなる
- エディタの慣行は `{sectionId}_{ランダム12文字}`（例: `abilities_x7k2m9p4q1w8`）
- canonical path（`{sectionId}.{fieldId}`）も全体で一意であること

### 3.3 label — 表示名

- 最大 128 文字。**空白のみは拒否**（section・field・block・pool・partsKey の label）
- `options[].label` と `description` は空でもよい

---

## 4. sections

```jsonc
{
  "id": "abilities",
  "label": "能力値",
  "fields": [ /* §5–6 */ ],
  "layout": { "preset": "grid", "columns": 3 },   // 省略可（§4.1）
  "blocks": [ { "id": "combat", "label": "戦闘", "cap": 80 } ],          // 省略可（§4.2）
  "pools":  [ { "id": "job_pts", "label": "職業P", "total": { "formula": "{abilities.edu} * 20" }, "partsKey": "growth" } ]  // 省略可（§4.3）
}
```

### 4.1 layout — 検証は「警告のみ」・不正でも保存できる

- `preset`: `stack`（縦一列・既定）| `grid` | `table`
- `columns`: grid のとき 2 | 3 | 4（既定 2）
- field 側の `layout.span`: 1 | 2 | 3 | `"full"`（既定 1）
- **layout はどんな不正値でも publish を止めない**。無効な値は警告
  （`layout-invalid-ignored` 等）を出して無視される。壊れた layout で入力が壊れることはない。

### 4.2 blocks — セクション内のグループ

- `cap`: 数値 or `{ "formula": "…" }`。所属フィールドの max の既定値（**合計上限ではない**）
- field は `blockId` で所属を宣言する。**宣言されていない block id の参照は拒否**
- フィールドが 1 つも所属しない block は警告（publish は通る）

### 4.3 pools — 合計予算の集計枠

- `total`（必須）: 数値 or 式。`partsKey`（必須）: 集計対象の内訳キー
- `scope`（省略可）: block id の配列。**宣言済み block のみ参照可**
- `partsKey` は scope 内のいずれかの scalar が `partsKeys` で宣言している id であること（拒否）

---

## 5. フィールド共通仕様

全 7 型（scalar / computed / roll / track / list / relation / tag）に共通:

```jsonc
{
  "type": "scalar",
  "id": "str",              // 必須（§3.1）
  "uid": "abilities_str",   // 必須（§3.2）
  "label": "STR",           // 必須・非空（§3.3）
  "description": "筋力",     // 省略可
  "role": { … },            // 省略可（§5.1）
  "visibleTo": "public",    // 省略可。"public" 以外（owner / gm）は【未対応で拒否】
  "when": "…",              // 【書くと拒否】（未対応）
  "layout": { "span": 2 },  // 省略可（不正値は警告で無視）
  "blockId": "combat"       // 省略可（宣言済み block のみ）
}
```

### 5.1 role — Discord パレットへの投影

3 種の判別 union。`kind` で分岐する。

| kind | 形 | 意味 |
|---|---|---|
| `rollable` | `{ "kind": "rollable", "notation": "1d100<={value}", "group": "ability" }` | 判定ボタン。notation は BCDice へ渡す補間記法（§8.1） |
| `resource` | `{ "kind": "resource", "deltas": [-1, 1, -5] }` | ± ボタン。deltas は **0 を含まない**数値 1 個以上（0 は拒否） |
| `profile` | `{ "kind": "profile" }` | プロフィール表示 |

- `secret: true` は全 kind で【未対応で拒否】。`role.when` も拒否。

---

## 6. フィールド型別仕様

### 6.1 scalar — 単一値の入力

```jsonc
{
  "type": "scalar", "id": "str", "uid": "abilities_str", "label": "STR",
  "valueType": "number",              // 必須: number | text | boolean | select
  "parts": true,                       // 省略可: 自由キーの内訳を持つ（Discord ± の器）
  "partsKeys": [                       // 省略可: 宣言済み内訳（parts:true と併用【拒否】・1 個以上）
    { "id": "growth", "label": "成長", "default": 0 }   // default: 数値 or {formula}
  ],
  "max": { "formula": "{abilities.edu} * 5" },   // 省略可: 数値 or 式（助言扱い・超過値も保存される）
  "rollOnCreate": { "notation": "3d6*5", "partsKey": "base" },  // 省略可（§6.1.1）
  "options": [ { "label": "6版", "value": "6e" } ]              // select 用の選択肢
}
```

制約:

- **`max` / `partsKeys` を書けるのは「セクション直下の valueType=number の scalar」だけ**。
  text/boolean/select や、list 内・relation 内の scalar に書くと拒否。
  さらに scalar 以外の型（computed 等）に `max` / `partsKeys` キーが存在するだけで拒否
  （track の `max` は別契約で必須。§6.4）。
- `partsKeys[].id` は §3.1 の id 規則＋予約キー `base` / `other` 不可・field 内で一意。
- `partsKeys[].default` の式は number 型・参照解決・循環検査・ステップ見積もりの対象。
- 同一 block 内で同じ partsKey id を複数フィールドが宣言する場合、**label は一致必須**。

#### 6.1.1 rollOnCreate（scalar / track 共通の作成時ロール）

- `notation`: **standalone roll 文法（§8.3）。placeholder `{…}` は全面禁止**。
- `valueType: "number"` の scalar のみ（text/boolean/select は拒否）。
- `partsKey`（省略可）: 出目の行き先。受理は **`base` か自フィールドが宣言した partsKeys の id だけ**。
  `other` は拒否（Discord ± の書き込み先と混ざるため）。track は partsKeys を宣言できないので
  実質 `base` のみ。
- **list の itemFields 内・relation の attrs 内では宣言自体を拒否**（作成時に走査されないため）。

### 6.2 computed — 式による導出値

```jsonc
{
  "type": "computed", "id": "hp", "uid": "status_hp", "label": "HP",
  "resultType": "number",             // 必須: number | text | boolean | dice
  "formula": "floor(({abilities.con} + {abilities.siz}) / 10)"   // 必須（§7）
}
```

- 式の静的型が `resultType` と一致しないと拒否。
- `resultType: "dice"` は特殊で、式が **「dice リテラル文字列の `+` 連結」か「dice を返す
  lookup」か「dice の computed への参照」** のみで構成されている必要がある
  （例: `lookup({abilities.str} + {abilities.siz}, damage_bonus)`）。
  dice リテラルは `'+1d4'` のような notation fragment（§8.2）。

### 6.3 roll — 作成時ロール専用のダイス宣言

```jsonc
{
  "type": "roll", "id": "luck", "uid": "status_luck", "label": "幸運",
  "notation": "3d6*5"    // 必須
}
```

- **roll 型はキャラクター作成時にサーバーがロールする対象**（振り直しも同じ）。
  クライアントが値を提出する入力欄ではない。
- notation の検証は 2 段階:
  - 保存時: `{…}` 参照の解決と型検査（参照先は number scalar / track /
    number・dice の computed のみ。未クローズ `{` は拒否）
  - **publish 時: standalone roll 文法（§8.3）**。placeholder は不透明項として許容されるが
    **literal dice 項（`3d6` 等）が最低 1 つ必須**・`/` や比較演算子は不可
- したがって `1d100<={value}` のような**判定記法は roll 型には書けない**（publish で拒否）。
  判定ボタンが欲しい場合は `role: { kind: "rollable", notation: "1d100<={value}" }` を使う（§5.1）。
- **list の itemFields 内では roll 型そのものが拒否**（v1 制約）。

### 6.4 track — 現在値/最大値（HP・MP・SAN）

```jsonc
{
  "type": "track", "id": "hp", "uid": "status_hp", "label": "HP",
  "max": { "formula": "floor(({abilities.con} + {abilities.siz}) / 10)" },  // 必須: 数値 or 式
  "style": "gauge",                    // 必須: gauge | checkboxes
  "min": 0,                            // 省略可（既定 0）
  "rollOnCreate": { "notation": "3d6" },        // 省略可（§6.1.1・partsKey は base のみ）
  "thresholds": [ { "at": 3, "label": "瀕死" } ],  // 省略可
  "resetOn": "session",                // 省略可: scene | session | rest
  "resetTo": "max"                     // 省略可: "zero" | "max" | { "formula": "…" }
}
```

- `max` が数値なら `max >= min` 必須。`thresholds[].at` は min〜max の範囲内（max が数値のとき）。
- `resetTo: "zero"` は `min > 0` だと拒否。`resetTo` の式は number 型で**自分自身の参照は拒否**。
- min/max は**全経路で助言扱い**。範囲外の出目・提出値・±増減も raw のまま保存される。
- checkboxes 表示は max 30 まで（超えると数字表示になる。保存は拒否されない）。

### 6.5 list — 行の繰り返し（技能・持ち物）

```jsonc
{
  "type": "list", "id": "skills", "uid": "skills_list", "label": "技能",
  "itemFields": [                      // 必須。行を構成するフィールド定義（再帰）
    { "type": "scalar", "id": "name",  "uid": "skills_name",  "label": "技能名", "valueType": "text" },
    { "type": "scalar", "id": "value", "uid": "skills_value", "label": "値",     "valueType": "number" }
  ],
  "rowRole": { "kind": "rollable", "notation": "1d100<={row.value}" }   // 省略可: 行ごとの判定
}
```

itemFields 内で【拒否】されるもの:

- `roll` 型（v1 未対応）
- `list` 型（入れ子リスト不可）
- `rollOnCreate` を持つ scalar / track（作成時に行が存在しないため）
- `max` / `partsKeys` を持つ scalar（セクション直下限定のため）

`rowRole.notation` では `{value}` は使えず `{row.サブフィールドid}` を使う（逆に通常の
`role.notation` では `{row.…}` は使えない）。

### 6.6 relation — 他キャラ・自由テキストへの関係

```jsonc
{
  "type": "relation", "id": "bonds", "uid": "bonds_rel", "label": "絆",
  "targetKind": "character",           // 省略可: character | freeText
  "attrs": [                           // 省略可: 関係に付く属性（scalar のみ）
    { "type": "scalar", "id": "level", "uid": "bonds_level", "label": "深度", "valueType": "number" }
  ]
}
```

- attrs は **scalar のみ**。`rollOnCreate`・`max`・`partsKeys` は拒否。

### 6.7 tag — タグ入力

```jsonc
{
  "type": "tag", "id": "traits", "uid": "traits_tag", "label": "特性",
  "catalog": ["勇敢", "臆病"],         // 省略可: 候補一覧
  "allowFreeInput": true               // 省略可: 自由入力の許可
}
```

---

## 7. 式（formula）の文法

`computed.formula`・`max`/`cap`/`total`/`partsKeys[].default`/`resetTo` の
`{ "formula": "…" }` で共通の文法。

### 7.1 構成要素

| 要素 | 例 | 備考 |
|---|---|---|
| 数値リテラル | `5`・`0.5`・`.5` | |
| 文字列リテラル | `'text'`・`"text"` | `\` エスケープ可 |
| 真偽リテラル | `true`・`false` | |
| フィールド参照 | `{abilities.str}` | `{セクションid.フィールドid}` |
| list 集計参照 | `{skills.list.value}` | `sum`/`count` の引数内のみ（§7.3） |
| 行内参照 | `{row.value}` | list の itemFields 内の computed のみ |
| テーブル名 | `damage_bonus` | 裸の識別子は lookup のテーブル名扱い |
| 演算子 | `+ - * / == != < <= > >=`・単項 `+ -` | 優先順位: 比較 < 加減 < 乗除 < 単項 |
| 括弧・関数 | `floor(…)` | |

### 7.2 関数（この 9 個だけ・未知関数は拒否）

| 関数 | 引数 | 戻り型 |
|---|---|---|
| `floor` / `ceil` / `round` | number 1 個 | number |
| `max` / `min` | **number 2 個**（3 個以上は拒否） | number |
| `if` | (boolean, T, T) — 両分岐は同型必須 | T |
| `lookup` | (キー, テーブル名) または (テーブル名, キー) | テーブルの resultType |
| `sum` | list サブフィールド参照 1 個（number のみ） | number |
| `count` | list サブフィールド参照 1 個 | number |

### 7.3 型規則（違反は拒否）

- 算術（`- * /` と number 同士の `+`）は number のみ。
- `+` の特例: 両辺が dice 候補（dice リテラル・dice lookup・dice computed）なら dice 連結。
- `==` / `!=` は同型スカラー同士（dice は不可）。`< <= > >=` は number のみ。
- 参照先の型: scalar number/boolean → そのまま・text/select → text・computed → resultType・
  track → number・roll → dice・tag/relation → text。**list 本体の直接参照は不可**
  （`sum({skills.list.value})` の形でのみ触れる）。
- list サブフィールド参照は sum/count の**中でだけ**許される（外はエラー）。
- **循環参照は拒否**（computed の式・partsKeys の default 式を辺としたグラフで検査）。

---

## 8. ダイス記法（notation）— 3 つの文脈で文法が違う

ここが最も間違えやすい。**同じ「notation」という名前で 3 つの契約がある。**

| 文脈 | 文法 | placeholder | 検証タイミング |
|---|---|---|---|
| `role.notation` / `rowRole.notation` | 補間記法（§8.1）。BCDice へ素通し | `{value}` / `{ref}` 可 | 保存時（参照検査のみ） |
| `roll.notation` | 補間記法 ∩ standalone 文法 | `{ref}` 可（不透明項扱い） | 保存時＋**publish 時に §8.3** |
| `rollOnCreate.notation` | standalone 文法のみ | **全面禁止** | 保存時から §8.3 |

### 8.1 補間記法（判定ボタン用）

文字列の中に `{…}` トークンを埋め込む。実行時に値へ置換して BCDice へ渡す。

- `{value}`: 自フィールドの値（rowRole では不可 → `{row.subId}` を使う）
- `{abilities.str}`: 他フィールド参照。参照先は **number scalar / track /
  number・dice の computed** のみ（text 等は拒否）
- `{+ref}` / `{-ref}`: 符号付き展開。値が 0 なら丸ごと消える（`+0` が残らない）
- `{{` / `}}`: リテラルの `{` `}`
- 閉じない `{` は拒否。**比較演算子など BCDice 方言はここでは自由**（`1d100<={value}` 可）

### 8.2 notation fragment（dice リテラル）

computed の dice 式・lookup の dice 結果値に使える断片。正規表現:
`^[+-]?(\d+(\.\d+)?|\d*d\d+)([+-](\d+(\.\d+)?|\d*d\d+))*$`（空白・`{}`・`;` 不可）。
例: `-2`・`0`・`+1d4`・`2d6+1`。

### 8.3 standalone roll 文法（作成時ロール用）

サーバーが単独で振れる式。受理・拒否の実例（`standalone-roll.spec.ts` が pin）:

- **受理**: `d6`・`2d6+1d4`・`3d6*5`・`(2d6+6)*5`・`100d6`・`d1000`
  （roll 型のみ: `1d8{derived.db}`・`{main.n}d10` のような placeholder 連結も可）
- **拒否**: 空・`10`（dice 項が無い）・`1d6/2`（除算不可）・`1d6;drop`・`0d6`・`1d0`
- 上限: 式 256 文字・literal dice 合計 100 個・面数 1000

---

## 9. tables — lookup テーブル

```jsonc
{
  "id": "damage_bonus",
  "uid": "tbl_damage_bonus",     // 省略可
  "resultType": "dice",          // 省略可: number | text | boolean | dice
  "rows": [
    { "min": -999999, "max": 64,  "result": "-2" },        // 範囲行
    { "min": 125,     "max": 164, "result": "+1d4" },
    { "key": "A", "result": 10 },                          // キー行（string|number|boolean）
    ["B", 20],                                             // タプル形式 [key, result]
    [165, 999999, "+1d6"]                                  // タプル形式 [min, max, result]
  ]
}
```

- 行数上限 **512**。id は §3.1 の規則・tables 内で一意。
- `resultType` の決定順: 行の `resultType` > テーブルの `resultType` > 値からの推論
  （文字列は notation fragment なら dice、それ以外 text）。
- **rows の中身は保存時には構造検証されない**（`z.array(z.any())`）。式から lookup で
  参照された時点で型・fragment 検査が効く。参照されないテーブルの行の破損は素通りする。
- **lookup miss（該当行なし）は評価全体を失敗させる**。数値域を覆う番兵行
  （`-999999`〜`999999`）を置くのが配布テンプレートの慣行。

---

## 10. 量的上限の一覧

| 対象 | 上限 | 定義箇所 |
|---|---|---|
| id | 32 文字（パターン込み） | `publish.ts` `SHEET_ID_PATTERN` |
| uid | 128 文字 | `MAX_UID_LENGTH` |
| label | 128 文字 | `MAX_LABEL_LENGTH` |
| 式 1 本の AST ノード | 256 | `evaluator.ts` `DEFAULT_AST_NODE_LIMIT` |
| テンプレート全体の静的評価ステップ見積もり | 10,000（list の式は 512 倍で計上） | `DEFAULT_STEP_LIMIT` |
| lookup テーブル行数 | 512 | `DEFAULT_TABLE_ROW_LIMIT` |
| list の評価行数 | 512（超過分は無視） | `LIST_ROW_LIMIT` |
| standalone roll 式長 | 256 文字 | `standalone-roll.ts` |
| standalone roll literal dice 合計 | 100 個 | 〃 |
| standalone roll 面数 | 1,000 | 〃 |
| 診断 message | 512 文字（超過は切り詰め） | `MAX_ISSUE_MESSAGE_LENGTH` |

※ `astNodeLimit` 等はオプションで下げられるが、既定値より上へは上げられない（cap される）。

---

## 11. publish だけで追加される検証

1. **visibility = public 必須**（400: `published template visibility must be public`）
2. engine 検証の再実行（保存後に seed 等で壊れた行の防御）
3. **standalone-notation**: 全 roll 型 field の notation に §8.3 を適用
4. **projection-key**: Discord 互換投影のキー衝突検査。scalar/computed/track/roll の
   field id は、section id ごとに投影先（`status` / `parameter` / `skill` / `item` /
   `description`、**それ以外の section id は全部 `description` 扱い**）へ集められ、
   **同じ投影先内で field id が重複すると拒否**。
   例: section `foo` と section `bar`（どちらも投影先 description）の両方に
   field id `note` があると publish できない。

---

## 12. 実例

### 12.1 最小の有効テンプレート（create body）

```json
{ "name": "最小テンプレート" }
```

sections/tables は空でよい（空 section には警告が出るが保存・publish とも通る）。

### 12.2 機能を一通り使った例（sections/tables 抜粋）

```jsonc
{
  "name": "CoC 風サンプル",
  "version": "1.0.0",
  "gameSystemId": "Cthulhu",
  "visibility": "public",
  "settings": { "rounding": "floor" },
  "sections": [
    {
      "id": "abilities",
      "label": "能力値",
      "layout": { "preset": "grid", "columns": 4 },
      "fields": [
        {
          "type": "scalar", "id": "str", "uid": "abilities_str", "label": "STR",
          "valueType": "number", "parts": true,
          "rollOnCreate": { "notation": "3d6*5" },
          "role": { "kind": "rollable", "notation": "1d100<={value}", "group": "ability" }
        },
        {
          "type": "scalar", "id": "con", "uid": "abilities_con", "label": "CON",
          "valueType": "number", "rollOnCreate": { "notation": "3d6*5" }
        },
        {
          "type": "scalar", "id": "siz", "uid": "abilities_siz", "label": "SIZ",
          "valueType": "number", "rollOnCreate": { "notation": "(2d6+6)*5" }
        }
      ]
    },
    {
      "id": "status",
      "label": "ステータス",
      "fields": [
        {
          "type": "track", "id": "hp", "uid": "status_hp", "label": "HP",
          "style": "gauge",
          "max": { "formula": "floor(({abilities.con} + {abilities.siz}) / 10)" },
          "role": { "kind": "resource", "deltas": [-1, 1] }
        },
        {
          "type": "computed", "id": "db", "uid": "status_db", "label": "DB",
          "resultType": "dice",
          "formula": "lookup({abilities.str} + {abilities.siz}, damage_bonus)"
        }
      ]
    },
    {
      "id": "skills",
      "label": "技能",
      "fields": [
        {
          "type": "list", "id": "list", "uid": "skills_list", "label": "技能一覧",
          "itemFields": [
            { "type": "scalar", "id": "name",  "uid": "skills_name",  "label": "技能名", "valueType": "text" },
            { "type": "scalar", "id": "value", "uid": "skills_value", "label": "値",     "valueType": "number" }
          ],
          "rowRole": { "kind": "rollable", "notation": "1d100<={row.value}" }
        }
      ]
    }
  ],
  "tables": [
    {
      "id": "damage_bonus", "resultType": "dice",
      "rows": [
        { "min": -999999, "max": 64,  "result": "-2" },
        { "min": 65,      "max": 84,  "result": "-1" },
        { "min": 85,      "max": 124, "result": "0" },
        { "min": 125,     "max": 164, "result": "+1d4" },
        { "min": 165,     "max": 999999, "result": "+1d6" }
      ]
    }
  ]
}
```

---

## 13. 代表的な拒否パターン早見表

| 送った JSON | 結果 |
|---|---|
| `"schemaVersion": 2` | 400（3 のみ） |
| `"version": "1.0"` | 400（semver でない） |
| field id `"STR"` / `"1st"` / `"max"` | 400（パターン違反・予約語） |
| uid 重複・canonical path 重複 | 400 |
| `"visibleTo": "gm"`・`"when": "…"`・`role.secret: true` | 400（未対応） |
| `deltas: [0]`・`deltas: []` | 400 |
| text scalar に `max` / computed に `partsKeys` キー | 400 |
| `parts: true` と `partsKeys` の併用 | 400 |
| `rollOnCreate.notation: "3d6+{abilities.str}"` | 400（placeholder 禁止） |
| `rollOnCreate.partsKey: "other"` | 400 |
| list 内に roll 型・list 型・rollOnCreate | 400 |
| 式に `pow({a},2)` | 400（未知関数） |
| 式で `{skills.list.value}` を sum の外で参照 | 400 |
| computed 同士の循環参照 | 400 |
| roll 型 notation `1d100<={value}` | draft 保存は通り **publish で 400** |
| 投影先が同じ 2 section に同 id の field | draft 保存は通り **publish で 400** |
| `visibility: "private"` のまま publish | 400 |
| 未知キー（例: `"myCustomKey": 1`） | **通る**（保持される・§1） |
