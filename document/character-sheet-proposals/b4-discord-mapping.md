# 案B4: Discord 連携マッピング設計（横断）

> **分類**: B系（横断コンポーネント。A系のどれを選んでも必要）
> **ステータス**: 案出し（未決定）
> **最終更新**: 2026-07-06

## 一言でいうと

「テンプレートで自由化したシート」を既存の Discord 体験（スレッドのロールボタン・±操作・履歴・キャラ embed）へ
確実に接続するための設計。鍵は 2 つ:
**(1) テンプレート作者が Discord UI を「注釈」で設計できること**、
**(2) ボタン押下のホットパスでは評価済みの実体（palette）だけを読むこと**。

## ロール注釈（テンプレート側に持つデータ）

フィールド（A2）またはブロック（A4）に `role` を付与する:

```ts
role:
  | { kind: 'rollable'; notation: string /* 例 "1d100<={value}" */; group: 'skill' | 'ability' | 'custom' }
  | { kind: 'resource'; deltas: number[] /* 例 [1, 5] */; showInEmbed: boolean }
  | { kind: 'profile' }   // embed のヘッダ等に表示
  | { kind: 'secret' }    // GM のみ表示（将来のシークレット機能と接続）
```

- 作者が「スレッドにどのボタンがどの順で並ぶか」をテンプレートで決められる
  ＝ **Discord 卓 UI そのものを配布できる**（B3 のバンドル配布と接続。本アプリの差別化ポイント）
- A4 を採る場合、ブロック型が role を内蔵するのでこの注釈はほぼ不要になる（SkillList → rollable 群、Resource → resource）

## 実体化（materialization）— ホットパスの設計

キャラ保存時に、テンプレート＋values から **roll palette** を評価・生成して character 側へ persist する:

```ts
// character ドキュメント内（または別コレクション）
rollPalette: Array<{
  key: string        // fieldId（customId に埋め込む）
  label: string      // ボタン表示名（例 "目星 (65)"）
  notation: string   // 評価済み bcdice 記法（例 "1d100<=65"）
  group: string      // 'skill' | 'ability' | ...
}>
```

- **理由**: ボタン押下 → `findByChannelId` → 即ロール、の経路に「テンプレート取得＋式評価」を挟まない。
  性能のためでもあるが、それ以上に **projection（S-1 の教訓）と障害面を最小化**するため
  — Discord 側が読む新フィールドは `rollPalette`（＋resource 定義）だけになり、`.select(...)` の追加も 1 箇所で済む
- palette の再生成タイミング: シート保存時・テンプレート再実体化時（B2）。Discord の±操作後は該当部分のみ更新

## customId 契約 v2

- 現行の `skill_{channelId}_{skillKey}` / `ability_{channelId}_{abilityKey}` は **5 セクション前提**の語彙
  → `roll_{channelId}_{fieldKey}` へ一般化する（新契約は現行どおり Factory / Parser / pattern 定数の
  custom-id モジュールとして作り、文字列直書き禁止を踏襲）
- 制約: Discord の customId は **100 文字上限** → fieldKey の長さ・文字種規約が必要
  （A2 の fieldId 命名規約と共通化。channelId ≈ 19 桁 ＋ prefix を引いた残りが実質上限）
- 旧契約（skill_/ability_）は legacy テンプレートのキャラのために併存させ、registry 上は別 handler のまま段階廃止

## UI 上限との整合

- ボタンは 1 メッセージ最大 25（5×5）。現行実装は 20 個で切り詰め（`thread-interaction.service.ts` の `slice(0, 20)`）
  → palette が閾値を超えたら **StringSelectMenu（1 つ 25 選択肢×最大 5 行）へ自動フォールバック**、
  または group ごとのページ切替。「よく使う項目のピン留め」（テンプレート注釈 or ユーザー設定）も併用候補
- resource role は ±ボタンを自動生成。増減の書き戻しは **sheet.values →（再 materialize）→ sections/palette** の
  単方向を守る（B2。現行 `applyDiscordDelta` の「values.other へ加算」相当の役割は palette 側の書き戻し先解決が担う）
- チャットパレット: palette から `/user-dice`（オリジナルダイス表）形式を自動生成し、個人パレットとマージできると
  テンプレート導入の即効性が上がる

## 責務境界（ドメイン設計ガイドの遵守）

- 注釈・palette は「**データ**」＝ template / character ドメインの所有。
  ButtonBuilder / SelectMenu 等の **UI 生成は discord/features の所有**（ドメインに discord.js を入れない）
- discord → domains は **DI 直呼び**（イベント RPC 禁止）。
  palette 更新をスレッド embed へ反映したい場合は、`character.sheet.updated` のような通知イベントを
  discord 側 feature が購読して更新する（characterEdit の ChannelCreate リスナー等と同型のパターン）

## 決めるべきこと

1. palette の持ち方（character ドキュメント内フィールド or 別コレクション。サイズと更新頻度で判断）
2. テンプレート由来 palette と個人チャットパレット（/user-dice）のマージ規則
3. role 語彙の初期セット（rollable / resource / profile / secret から開始し、拡張はテンプレート schemaVersion で管理）
4. 旧契約（skill_/ability_）の併存期間と廃止条件
