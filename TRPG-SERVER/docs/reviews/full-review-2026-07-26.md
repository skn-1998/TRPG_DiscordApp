# TRPG-SERVER 全体レビュー報告（2026-07-26）

**実施方法**: 4観点（正しさ・バグ / 認知負荷 / 変更容易性 / 負債の棚卸し）。
1層 = 読み取り専用レビュアー9体（正しさ×7分担 + cognitive-load-review + review-changeability）、
2層 = Must 級所見に対する独立の敵対的検証7体（反証を試みる形式）。全員コード変更・テスト実行なし。
3層 = Codex CLI（gpt-5.6-sol・xhigh・read-only sandbox）による独立再検証（2026-07-26 round1: verdict **pass**。
Must 16件＋降格7件の全23判定が維持され、severity=medium の訂正2件〔CE-3 の影響範囲・CT-1 の到達経路〕を本書へ反映済み。
証跡: `review-results/full-review-verify/`）。
**対象**: `TRPG-SERVER/src` 326 非テストファイル（約3.5万行）+ `packages/sheet-projection` + `test/` 基盤。作業ツリーの未コミット変更込みの現状。
**実測ゲート**: `pnpm run build` 成功 / `check:circular` = No circular dependency found!（550ファイル）/ 全テスト **209 suites・2676 tests 全通過**（45.7s）。
**注意**: テストが緑でも下記のとおり「誤ったモックで緑」「デッドコードで緑」の乖離が多数ある。緑＝正しさの証明ではない。

関連: 詳細な per-observation の根拠（file:line と失敗シナリオ）は本書の各表に集約した。判定列は2層検証の結論。

---

## 1. 検証済み Must（優先対応。上から緊急度順）

| #   | ID          | 判定                          | 場所                                                                                                               | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ----------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | TI-1        | 確定                          | `TRPG-SERVER/.env.test`                                                                                            | **MongoDB Atlas 資格情報（ユーザ名・パスワード込み URI）が平文でコミット・追跡中**。`.gitignore` 対象外・履歴にも残存。→ 資格情報ローテーション＋追跡解除＋（必要なら）履歴除去の運用判断が必要                                                                                                                                                                                                                                                                                        |
| 2   | DM-1        | CONFIRMED                     | `domains/auth/auth.controller.ts:207-219`                                                                          | `GET /auth/:userId/User` が**無認証**で Mongoose Document 全体を返す。暗号化済み Discord OAuth トークン・スコープ・失効日時・characterIds・PII が第三者に露出。`toUserOutput` presenter が存在するのに未使用。CORS はブラウザ外クライアントに無効                                                                                                                                                                                                                                      |
| 3   | SP-1        | CONFIRMED                     | `TRPG-SERVER/Dockerfile` / `docker-compose*.yml`                                                                   | PH-6b 新設 `@trpg/sheet-projection` が Docker 全ステージ未配線。lockfile に importer 記録済みのため `--frozen-lockfile` が失敗、通っても dist が無く起動時 require 解決不能。**コンテナデプロイが成立しない**。root に `build:projection` も無い                                                                                                                                                                                                                                       |
| 4   | EV-3        | CONFIRMED                     | `events/handlers/_shared/event-handler.base.ts:210-218`                                                            | リトライが `setTimeout(async ...)` の fire-and-forget で Promise 未捕捉。1回目 retryable → 再試行で非 retryable（例: ECONNRESET 後の CHARACTER_ALREADY_EXISTS）だと unhandled rejection。`node:22-alpine` 既定でプロセス停止。`process.on('unhandledRejection')` 登録も無し                                                                                                                                                                                                            |
| 5   | DM-2        | CONFIRMED                     | `domains/dice-roll/services/dice-execution.service.ts:108`                                                         | 正規化が `< > =` を黙って削除し `1d100<=30` → `1d10030`（面数10030のダイス）に化けて検証を通過・実行される。palette の rollable notation（`legacy-coc.template.ts:30` に `1d100<={value}` が実在）は roll-palette 経路で必ずこの clean を通る                                                                                                                                                                                                                                          |
| 6   | DC-6        | CONFIRMED                     | `discord/services/dice/dice-roll-logic.service.ts:159-171`                                                         | critical と extreme が同一式（`floor(skill/5)`）で**エクストリーム成功は到達不能**、クリティカル閾値も CoC7 の出目1でなく技能値/5。誤判定文字列が DB 保存される。spec がバグ挙動を固定化                                                                                                                                                                                                                                                                                               |
| 7   | DC-1        | CONFIRMED                     | `discord/discord.controller.ts:360-364`                                                                            | カテゴリ判定 `channel.type === '4'` だが供給側は `ChannelType[...]` 逆引きの名前文字列（'GuildCategory'）→ `POST /discord/post-character` は**常に404**。spec はモックが `'4'` を返すため緑（実装と乖離した誤モック）                                                                                                                                                                                                                                                                  |
| 8   | DC-2 / CH-4 | CONFIRMED                     | `discord.controller.ts` ほか                                                                                       | グローバル pipe 無し＋`@UsePipes` 無しで **discord 系 DTO の class-validator/transformer が実行時に一切効かない**（#RRGGBB→整数変換も不成立。DESIGN.md §4.5 の宣言済み不変条件が未成立）。認証（JwtAuthGuard）は有り。unit spec では原理的に検出不能                                                                                                                                                                                                                                   |
| 9   | DC-3        | PARTIAL（核心成立）           | `discord.controller.ts:418-425` → `discord-guild-manager.service.ts:393-410`                                       | `verifyGuildManagePermission` の実体は**ギルド在籍確認のみ**（PermissionsBitField 判定なし）。在籍者は `create-channel` で任意名・任意 `permissionOverwrites` のチャンネルを作成可能（DTO 未検証=DC-2 と複合）。※post-character の並記は誤り（DC-1 により手前で404）                                                                                                                                                                                                                   |
| 10  | DM-3        | CONFIRMED                     | `domains/character/character-http.exception.ts:34,59-63`                                                           | `@Catch()` 全捕捉で `getStatus()` 不参照 → JwtAuthGuard の **401 / ValidationPipe の 400 が 500 に化ける**（開発環境ではスタックも返る）                                                                                                                                                                                                                                                                                                                                               |
| 11  | DM-4 / EV-2 | PARTIAL（結果成立・機序訂正） | `core/http/http-exception.filter.ts:49-80`                                                                         | user 系も 401/400→500。機序の訂正: 例外フィルタ経路では `ExecutionContextHost` の handler が常に null のため **`@ApiErrorResponse` メタは実行時に一切適用されず**、常に既定 500/「エラーが発生しました」。spec は実在しない host を捏造して緑                                                                                                                                                                                                                                          |
| 12  | CE-3        | CONFIRMED                     | `core/http/error-handler.ts:257-267` + characterEdit 3箇所                                                         | `handleServiceError` は必ず throw するため、catch 節でその後に書かれたユーザー通知・フォールバックが**全て到達不能**。defer/reply 済みの経路（モーダル送信・セクション選択）では上位の汎用 reply も抑止され**ユーザーへ何も表示されない**。未 defer のフィールド操作（モーダル表示前、`character-section-editor.service.ts:69-72`）では上流 `interactions.service.ts:88-93` の汎用エラー reply が返り得る（第3層検証で範囲を限定）。spec 3本中2本は逆挙動をスタブで固定、1本は未カバー |
| 13  | CE-1        | PARTIAL（核心成立）           | `characterEdit` モーダル保存経路（`character-modal-handler.util.ts:143-158` ほか）                                 | 編集モーダル保存で対象フィールドの `values` 内訳（base 以外の part）・`index`・`isVisible` が**消失**（合算値は base に入り直すため合計は不変）。破壊は編集対象1フィールドに限定。多 part データの実在は REST 経路（`PUT /character/:id`）の利用実態に依存                                                                                                                                                                                                                             |
| 14  | SP-2        | PARTIAL（核心成立）           | `sheet-materializer.service.ts:213-218` + `projection.ts:184-201` + `character-sheet-operation.service.ts:219-223` | track で範囲外 parts を書き込めた場合、表示（parts 生合計）と実効値（クランプ済み）が乖離。**マイナス方向の±ボタンは「✅ 更新しました」と返しながら実効値が動かない**（プラス方向は「上限です」を返す）。`partsValueSchema` に範囲検査なし                                                                                                                                                                                                                                             |
| 15  | SP-3        | PARTIAL（核心成立）           | `character.controller.ts:327`（from-template）→ hub 経路                                                           | `discordChannelId: ''` ハードコードのまま更新されず、hub 投稿時に `validateChannelId` 不一致で**ボタン・セレクトの無い hub が無音で投稿**される。customId の channelId も空になるため hub 操作系全体が無効。警告（warnings）は全消費箇所ゼロで捨てられる                                                                                                                                                                                                                               |
| 16  | TI-2        | 確定（構造）                  | `packages/*/package.json` + root scripts                                                                           | ワークスペース依存が `dist/` 前提なのにビルドフック無し。**クリーンチェックアウトでは該当 spec が「Cannot find module」で suite 丸ごと未実行**（過去事故と同型）。`build:projection` は存在すらしない                                                                                                                                                                                                                                                                                  |

### 2層検証で降格された所見（潜伏バグ・Should へ）

| ID   | 一次判定 | 訂正後         | 訂正理由                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---- | -------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CE-2 | Must     | Should（潜伏） | キャラ作成モーダルの customId 不整合は実在するが、作成ボタン付き Embed を投稿する経路自体がデッド（`displayNewCharacterCreation` 呼び出し元ゼロ）。過去投稿の残存ボタンでのみ再現                                                                                                                                                                                                                                                                                                                |
| DM-5 | Must     | Should（潜伏） | `findByChannelId` の projection に `item`/`description` 欠落は事実だが、items/desc タブの customId を生成する本番コードが現存しない（旧メッセージのボタンでのみ到達）                                                                                                                                                                                                                                                                                                                            |
| DM-6 | Must     | Should         | `POST /character` のチャンネル差し込みは**認証済みユーザー限定**・既存 characterId の上書きは unique index で不可・乗っ取り成否は非決定的。整合性破壊（未使用チャンネル先取り・解決先の曖昧化）は残る                                                                                                                                                                                                                                                                                            |
| CT-1 | Must     | Should         | スレッド作成の冪等性ガード欠如と最大4本作成（リトライ3回）は成立するが、`isRetryableError` の固定文字列リストに現実の例外がまず一致しないため発火確率低。現実的な入口はセレクトメニューの反復実行と、スレッド作成後の検証通信失敗（ECONNRESET 等）時のリトライに限られる。※`character.creation.completed.ts:149` の無検査 emit は `guildId: 'default-guild'` のため `guilds.fetch` で**作成前に必ず失敗**し二重作成の入口にはならない（第3層検証で訂正。副産物として DC-30 の下流が確定 — 下記） |
| EV-1 | Must     | Should         | LOG_* が validator に代入されず winston `transports: []` は事実（既定値すら適用されない）。ただし winston ロガーは**どこにも注入されておらず** `useLogger` も無いため、実ログは Nest 既定 Logger で出続ける。実体は「ログ機能一式が死に設定」                                                                                                                                                                                                                                                    |
| SP-5 | Must     | Should         | 投影キー `field.id` 衝突は publish 境界（`projection-key-validation.ts`）が scalar/computed を検査済み。すり抜けるのは **track/roll が絡む同一ターゲット内 id 重複のみ**（検査対象型の不足）                                                                                                                                                                                                                                                                                                     |
| CH-2 | Must     | Should（潜伏） | `thread-creation.util.ts` の旧形状前提は事実だが、この util を通る2つの customId をメニューに載せる本番コードが現存しない（`extractNumericValue` は本番デッド）。現行スレッド初期投稿は `CharacterEmbedService`（正しい読み方）経由                                                                                                                                                                                                                                                              |

---

## 2. Should 所見（領域別・要対応検討）

### セキュリティ・認可

- **DM-9** `discord.strategy.ts:22-27` — OAuth2 `state` 不使用（login CSRF 可能）
- **DM-10** `jwt-auth.guard.ts` + `cookie.service.ts:13` — SameSite=None Cookie 認証で CSRF 対策なし（状態変更エンドポイントが Cookie だけで実行可能）
- **DC-4** send-message の事前チェックが `ViewChannel` のみ（`SendMessages` 未確認）
- **DC-5** `send-message.dto.ts` の `components`/`fields` が実質 `any`（DC-2 と複合で内部 customId ボタンを Bot 名義で投稿可能）
- **DC-32** performance-dashboard の reset/system-info が JwtAuthGuard のみ（管理者チェックなし）
- **SP-15** hub の select/panel/browser 3ハンドラが所有者検査ゼロ（resource-delta は検査あり）。`FieldRole.secret` は全経路未参照
- **DM-18** template の 403/404 出し分けで存在推測が可能（Character/User は 404 統一なのに不統一）

### イベント基盤・非同期

- **EV-4** retryable 時に execute が正常解決 → registry が「成功」計上・発行元にも成功で返る（統計・契約の嘘）
- **EV-5** 冪等性なしのハンドラ全体再実行（作成成功が CHARACTER_ALREADY_EXISTS で失敗扱いに）
- **EV-16** `emit` が emitAsync を await するため購読側例外が発行元へ逆流、しかも retryable かどうかで非対称
- **EV-9** `waitForEvent` タイムアウト時のリスナー未解除・`once` が `off` で解除不能
- **EV-10** `ValidationError` 同名2クラス（name 文字列判定で回避中の脆い構造）
- **EV-11** ハンドラ登録失敗が warn のみで無言起動（キャラ作成イベント無反応でも気付けない）
- **EV-12** `EVENT_NAMES` の satisfies は全域性を保証しない＋AI.event.md 記載のイベントが契約に不存在
- **EV-14** `emitSuccessEvent(character: any)` + optional chaining で完了イベントが無言不発の経路
- **EV-8** `events.module.ts:3,41` — events core → discord/features の依存方向違反（不要 import。コメントは「撤去済み」と虚偽）
- **CT-1**（降格後）スレッド作成の冪等性ガード欠如＋二重 emit 経路
- **EV-6** `logError` のマスキング不全（生 additionalData が同居）/ **EV-7** `main.ts` 起動失敗時にエラーメッセージを捨てて exit(1)
- **EV-15** 例外フィルタ・インターセプタのグローバル登録なし（コントローラごとに形が分岐 — §3 CH-4 と同根）

### Discord 層

- **DC-7/DC-8** アラートが形状不一致で永遠に発火しない／解除コード不存在で一度出ると恒久 critical
- **DC-9 / CE-20 / CT-34**（3レビュアー一致）interaction registry の競合検出が初期化順序により handlers 0 件で空振り
- **DC-10** handler 契約テストが 25 件固定で実 28 件（hub 系 3 件が未検証）。DESIGN.md §11 も 23 件で古い
- **DC-11** facade メトリクスの二重計上 / **DC-12** 429 検知が到達不能（statusCode を渡す呼び出しゼロ）
- **DC-13** rate limiter の秒/ミリ秒取り違え＋cleanup 自壊（現状デッドコードだが有効化すると即事故）
- **DC-14** `getGuildInfo` が毎回全メンバー fetch / **DC-15** 認可検査の例外を「権限なし」に変換（API 障害と区別不能）
- **DC-16** チャンネルキャッシュがアクセス毎に TTL 更新（ホットなチャンネルは永久に再取得されない）
- **DC-18** `loadJsonFile` が失敗時 undefined 返却 → cwd 依存でモジュールロード時クラッシュ / **DC-19** `tableDice.ts:13` が引数配列を破壊的 reverse / **DC-20** d100 前提の演出閾値を全ダイスに適用（1d6 の 3 が「クリティカル」）
- **DC-21** CommandsController の共有可変 interaction フィールド（デッドだが危険構造） / **DC-25** エラー処理中の二次失敗が未保護 / **DC-30** `guildId: 'default-guild'` プレースホルダが契約上通過 →（第3層検証で下流確定）置換する購読者は存在せず `thread-manager.service.ts:72` の `guilds.fetch('default-guild')` で必ず失敗するため、**キャラ作成完了イベント経由の自動スレッド作成は機能していない**（`:149` のコメント「Orchestrator で更新される」は虚偽。実際に動くスレッド作成はセレクトメニュー経路のみ） / **DC-31** setName のレート制限（10分2回）で await が数分ブロックし得る

### characterEdit / characterThread / dice

- **CE-4** モーダル送信イベントが本番で一度も emit されない（フィールド名不一致で常に throw。モックは `''` を返すため緑）
- **CE-5/CE-6/CE-22** customId パース不整合群（session 形式解釈不能・100文字制限未考慮・ハイフン入り fieldKey 崩壊）
- **CE-7** customId 生成/解析の二重管理（契約モジュール側 Parser が production 参照ゼロ）— DESIGN §6.1 違反
- **CE-8** `[object Object]` 羅列 Embed がキャラ更新のたびに投稿され得る（25 field 上限チェックもなし）
- **CE-9** characterId 照合なしのメッセージ探索で別キャラの Embed を上書き
- **CE-10** フロント URL 通知が listener 未登録で不達（README は正の使い方として案内）
- **CE-11** 根拠のない 200ms 固定 sleep / **CE-12** `generateAppConfig()` 直呼び（ARCHITECTURE §11 違反）
- **CE-13** モーダルセッション 4 桁連番の衝突・リーク（衝突時は別キャラのデータで更新）
- **CE-14** materialized ガードがモーダル送信時のみ（表示・refresh 側に無く、旧 Embed 抑止が characterEdit 経路で未適用）
- **CE-15** 項目名だけの編集が不可＋誤った文言 / **CE-16** ID 採番 8 文字とコメントの乖離 / **CE-17** タイトル文言変更で編集メッセージ本体が削除される設計
- **CE-19** `CharacterCreationService` がイベント二重定義＋`characterId: 'pending'` の偽成功応答（README 通りに使うと壊れた URL）
- **CT-2/CT-3** 投稿フォールバックが成功分も再投稿して二重化／空スレッド残留＋偽の失敗表示
- **CT-4** 429 を一度踏むとその hub は永久未投稿（`none` の再試行経路なし）
- **CT-7** hub thread listener が 30 秒×250ms の DB ポーリング / **CT-8/SP-11** worker の無制限 edit ループ / **CT-9/SP-8** CAS 競合だけで 429 予算を消費
- **CT-10** hub 3ハンドラが 3 秒制約規約（OP-2）違反（DB 参照が ack より先）
- **CT-11** `.join('\\n')` エスケープ二重で desc タブが 1 行表示
- **CT-12/CT-13/CT-16** Embed field/label の長さ・空文字未検証（50035 → 偽エラー表示や CT-2 の二重投稿へ連鎖）
- **CT-14/CT-19/CT-28** customId 直書き 13 箇所＋直書き解析 3 箇所（Factory/Parser 迂回）
- **CT-15** gameSystemId 判定が実 ID（bcdice 形式）と全く合わず preset ボタンが事実上デッド
- **CT-17** 未 ack 時の followUp 失敗でユーザー無応答 / **CT-21** discordThreadId 保存失敗を握りつぶして success:true
- **CT-22** dice pagination の 7 adapter が完全空 catch（観測不能） / **CT-23** 26 ページ以上で select の value 重複 → API 拒否 / **CT-24** pagination ストアの定期 sweep なし（メモリリーク）
- **CT-26/CT-29** ack 前に DB・Discord API 複数往復（3 秒超過で Unknown interaction） / **CT-31** autocomplete がスレッドを候補に出すのに実行側が拒否 / **CT-39** スキル値 0 が「解決不能」と同一扱い

### domains / config / テスト基盤

- **DM-7** `DiceRollChannel` が本番で一切作成されず、キャラ別ページネーションが常に空（無言 no-op）
- **DM-8** draft autosave が publish 用全検証を通るため入力途中で 400（autosave 前提が不成立）
- **DM-11** ログインの check-then-act race（E11000 → 500） / **DM-12** User コレクション名指定漏れ（他モデルと不統一・環境により新旧分裂）
- **DM-13** CharacterModule が AuthModule 一式を不要 import / **DM-14/SP-17** feature 所有の controller が domain ファイルに同居（ARCHITECTURE §6 と逆）
- **DM-15** dice 履歴キャッシュの読み書き条件非対称（limit=500 でしか更新されない）＋多重起動非対応
- **DM-16** `isSecret` が保存されない（roadmap M2 の前提が欠落） / **DM-17** characterId 欠落が素の Error → 500
- **DM-19** published テンプレは public 必須なのに resolve が作者限定（配布機能が契約上成立しない）
- **SP-4** projection の warnings 全捨て（component 欠落・切り詰めが運用ログに出ない）
- **SP-6** hub の `error` 状態からの回復遷移が未定義（一時エラーでも恒久停止。管理経路もなし）
- **SP-7** worker の retryAttempts リーク / **SP-9** 送信済みなのに「投稿失敗」に分類 / **SP-10** markError の CAS 失敗を無検知
- **SP-13** スレッド再作成時に hub が旧スレッドへ残置 / **SP-14** sweep が 30 秒毎に全キャラ fetch / **SP-16/CL-7** `baseRevision` 受理・検証するだけで未使用（契約の嘘）
- **TI-3** CI 不在（全 suite 実行が人間の規律のみ） / **TI-4** `console.error` まで全モック化 / **TI-5** setup の定型出力 1,400 行超
- **TI-6** テストが本番 `.env` を素通し読み込み / **TI-7** restoreMocks 二重適用の罠 / **TI-8** 共有可変モックの汚染リスク / **TI-9** 効いていない per-file モック上書き
- **TI-10** e2e 設定の alias 欠落（e2e spec を書いた瞬間に全落ち） / **TI-11** TestAppModule 一式が参照ゼロ＋`TEST_AUTH_SECRET` 未定義で動作不能 / **TI-13** spec 用 tsconfig が `strict: false` を本体 src にも適用 / **TI-19** 新設 contract spec の env 未復元

### 認知負荷（cognitive-load-review: CL）

- **CL-1 [Must級]** `character-ui.service.ts`（521行）: 12 public 中 11 が runtime 呼び出しゼロの死蔵。横断スイープのたびに読解・編集対象になる。→ 削除推奨（生存 1 経路＋4 シンボルだけ残す）
- **CL-2 [Must級]** スレッド作成 2 経路複製: スレッド名生成が既に乖離（`🎭 {name} [date]` vs `🎭{name}`）、`buildThreadUrl` 同名 2 実装、ダイス UI 5 連投稿が 3 箇所複製、materialized 分岐の挙動差。同時把握 7 項目・8 ファイル
- **CL-3 [Must級]** customId リテラル直書きが探索側 4 箇所複製（ARCHITECTURE §15 明文禁止に抵触）＋ component type マジック数
- **CL-4** 二重ディスパッチ＋display 系 3 メソッド死蔵（`enhanced-character-edit.service.ts`、churn 最多 11回/6ヶ月）
- **CL-5** `event-registry.service.ts` 379 行でハンドラ 1 個登録・public API 5 本死蔵・doc が実態と乖離（「自動登録」は虚偽）
- **CL-6** `event-handler.base` の名前詐称（`emitErrorEvent`→log のみ、`moveToDeadLetterQueue`→log のみ、「冪等性」実装なし）
- CL-8〜CL-12（Info）: status タブが parameter を表示・ゴースト `updateCharacterEmbed`、`slice(-20)` 直書き 2 箇所、5 セクション語彙 7 箇所複製、根拠なし 200ms 待機、`createHubViewModel` 参照ゼロ
- **リファクタ不要と明示された対象**: `character-embed.util.ts`（純関数・直線的）、`character.repository.ts` 本体、`character-sheet-operation.service.ts` 本体、`packages/sheet-projection`（CL-12 以外）、`thread-orchestrator.service.ts` 単体、characterEdit の 6 handler（規約完全準拠）

### 変更容易性（review-changeability: CH / シナリオ S-1〜S-4）

- **CH-1 [Must級]** `PaletteEntry` 4 重定義＋`CharacterSheetState` 2 重定義（構造的に完全一致・zod は `.strict()`）。S-1（作者ピン留めフラグ＝Phase 3 決定事項 D-P3-2）が 4 owner 同期編集になる。→ `z.infer` 導出＋re-export で 4→2 owner へ
- **CH-2 [Must級→潜伏]** `AttributeValue` 読み取り 4 実装、うち 2 つが旧形状前提（現行はデッド経路だが正準形への追随漏れとして修正価値あり）
- **CH-3 [Must級]** 親チャンネル投稿ヘルパ 4 実装・3 意味論（PrivateThread 対応/非対応が経路で違う＝roadmap S2 ephemeral の着地点で既に乖離）
- **CH-4 [Must級]** = DC-2（グローバル pipe 不在で DTO 契約が実行時無効）。7 controller が 4 パターンに分岐（一覧表は本書 §1-8 と A-3 レポート参照）
- **CH-5** 同一ファイル内 57 行の embed 組み立て逐語重複 / **CH-6** preset dice の Factory 迂回 13 箇所＋ラベル二重管理（`（簡易）`有無のズレが既に発生）
- **CH-7** custom-id 19 モジュール中 Parser 欠落 10・pattern のみ 5 / **CH-8** スレッド初期投稿 Embed 2 系統並行稼働
- **CH-9** `discord/DESIGN.md` の Phase 0 残件・Phase 4 前提が実装と乖離（名指しファイルが不存在。計画実行の空振り要因）
- **CH-10** `hub-projection.service.ts`（S-1 の唯一の変更 seam）だけ spec 不在
- **構造上位 3**: ①同一概念の契約 N 重定義 ②横断関心のグローバル境界不在 ③characterThread への並行実装の層状堆積
- **良い先例（分離維持が正しい）**: `dice-save-key.util.ts` の 2 関数（契約が明確に異なり理由もコメント化）、characterSheet feature の新規構造（1 view builder・薄い handler・2 呼び出しの seam）

---

## 3. Info 所見（抜粋）

- EV-17〜EV-23: enrichContext の上書き順・configuration の記述矛盾・config factory 内 `process.exit(1)`・**`src/types/` 4 ファイル完全デッド**・テスト専用コードの dist 混入・`handleHttpError` デッド・契約とドメイン入力の characterId 不一致
- DC-22〜DC-29 系: InteractionsController 重複デッド・allSettled 結果未検査・到達不能 try/catch・`position/nsfw/rateLimitPerUser` の暗黙無視・タイマー後始末なし・guildManager の未使用メソッド群・facade `performMaintenance` デッド
- CE-21〜CE-30 系: 空 channelId の伝播・部分文字列判定・カテゴリ未設定の無警告継続・README 乖離・`CHARACTER_EDIT_CONFIG` 死蔵＋値の不整合・JSDoc 乖離・`sanitizeChannelName` 二重実装
- CT-20/25/30/32/33/35〜38/40: タブ種別の契約不整合・`DiceButtonService` デッド・応答文言の不正確・autocomplete の余分フィールド・同名チャンネル非決定解決・parent-channel 重複・feature→feature 依存（CT-36）・cwd 相対パス・`characterThreadIds` デッド
- DM-20〜DM-28: `updateDiscordEmbed` 残骸・死んだ projection キー（`attributes primaryAttributes`）・DTO と実装の不一致・実行されないバリデーション定義・NaN 経路・timestamps 三重管理・レガシードメイン URL・TOCTOU（unique index が防壁）・remove の応答 3 形
- SP-19〜SP-24: formatResourceValue の fallback が index を合算し得る・到達不能な allowsParts 検査・opId が embed footer に恒久露出・警告 dedupe 不統一・index 式のセクション 1000 件境界・root scripts の非対称
- TI-14〜TI-18/TI-20/TI-21: ts-jest 非推奨設定・空 factories ディレクトリ・smoke.spec の水増し・TEST_DB_NAME 上書き衝突・観測できないモック二重定義。**安全確認済み**: 削除ヘルパー参照残存ゼロ・test-auth の本番混入経路ゼロ（3 重遮断）・testPathIgnorePatterns の意図せぬ除外ゼロ・testcontainers の危険な既定値ゼロ

---

## 4. 負債の着手順（debt-prioritization Decision Artifact）

```text
Decision status: recommendation-supported
Decision context:
  Actor: リポジトリ所有者（単独開発・Fable 主担当）
  Purpose: ロードマップ（Discord-native campaign workspace / 短期 S1-S5・中期 M1-M7）を
           進めながら実運用品質（正しさ・整合・セキュリティ）を確保する
           [supplied: document/feature-roadmap-2026-07-06.md, AI.md 次期優先事項]
  Context: 本レビューの検証済み所見一式 [observed]
  Constraints: 循環依存ゼロ維持 / AI.*.md 記録 / 挙動保存リファクタは特性化テスト先行
           [supplied: CLAUDE.md, trpg-refactor 方針]
  Decision horizon: 短期〜中期ロードマップ（〜数ヶ月）
  Available capacity: unknown
Decision requested: 改善候補（バグ修正クラスタ＋構造負債）の着手順
Criteria ledger:
  - purpose consequence（実運用被害・ロードマップ着地点）[roadmap = supplied]
  - expected change（S2/S3/S4/S5/M1 が触る領域）[supplied]
  - current interest（既に壊れている UX・レビュー観測）[observed]
  - structural exposure（伝播幅・N 重定義）[observed: A-3]
  - remediation burden（小/中/大の順序見積り）[inference]
```

**推奨順序（群内は同順位グループ。無理な全順序は付けない）**

| 群                                      | 候補                                                                                                                                                                                                                                                                                | 根拠（レンズ）                                                                                 | 負担見積り         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------ |
| **第0群: 即応**                         | TI-1 資格情報ローテーション＋追跡解除 / DM-1 に `@UseGuards`＋`toUserOutput` 適用                                                                                                                                                                                                   | 露出継続中（consequence 最大）。修正は局所                                                     | 小                 |
| **第1群: デプロイ成立**                 | SP-1 Docker 配線＋root `build:projection` / TI-2 pretest ビルドフック                                                                                                                                                                                                               | PH-7 実機受入の前提。**これが無いとコンテナで動かない**                                        | 小〜中             |
| **第2群: 確定バグ修正**（独立に並行可） | EV-3（setTimeout 内 catch）/ DM-2＋DC-6（ダイス正しさ。黙殺でなく明示拒否へ）/ DC-1＋DC-3（post-character 型・create-channel 認可）/ DM-3＋DM-4（getStatus 尊重）/ CE-3（回復パス）/ CE-1（内訳保全）/ SP-2＋SP-3（範囲検査・channelId 継承）。**各修正で誤モック spec も同時是正** | current interest（ユーザー可視の実害）＋ダイスは TRPG のコア価値                               | 各 小〜中          |
| **第3群: クラス根絶の構造投資**         | CH-4/EV-15: `APP_PIPE` → `APP_FILTER` の段階導入（interceptor はフロント互換の検討後）                                                                                                                                                                                              | DM-3/DM-4/DC-2 系の**再発クラスを一掃**。S1/S5/M1/M6 の Web 拡張は全て controller を増やす方向 | 中（互換確認込み） |
| **第4群: ロードマップ前提の負債**       | CH-1 契約一本化（**Phase 3 v3.1 着手前に**）/ CL-3＋CH-6＋CH-7 customId Factory/Parser 統一＋CL-2＋CH-3＋CH-8 characterThread 一本化（**S3 スレッド UI 再編の前に**）/ CH-9 DESIGN.md の実態同期                                                                                    | expected change: S-1 トレースで 4 owner 同期、S3 は characterThread に着地                     | 中〜大             |
| **第5群: 随時（純減）**                 | CL-1/CL-4/CL-5/CE-18/CE-19/EV-20/EV-22/DC-13 ほか死蔵一掃                                                                                                                                                                                                                           | 横断スイープ（6ヶ月で5回実績）のたびに死蔵を読むコストが消える                                 | 小（分割可）       |
| **保留**                                | 監視系（DC-7/8/11/12）は「修理か削除か」の判断のみ先に / e2e 基盤（TI-10/11）は e2e 導入時 / EV-1 は「ログ機能が要るか」の判断先行                                                                                                                                                  | 期待変更の証拠が弱い                                                                           | -                  |

**Sensitivity（順序が変わり得る仮定）**

- Atlas クラスタが現役かどうか → TI-1 の緊急度（現役なら即時、廃止済みなら第5群相当）
- PH-7 実機受入の時期 → 第1群が第0群と同時になる
- legacy キャラに多 part `values` が実在するか → CE-1 の実害規模（unknown: REST 経路の利用実態）
- capacity unknown のため群内の並びは未確定（群間の順序は evidence で支持）

**Handoffs**: 修正実施は本レビューの範囲外（trpg-refactor / nestjs-best-practices 経路へ。挙動保存を伴うものは特性化テスト先行）。
**Exclusions**: 実機再現・修正・テスト作成・ロールアウト計画は未実施。

---

## 5. レビューの限界

- 全観点とも**静的読解ベース**（実機・E2E 再現なし）。2層検証で到達性まで独立確認した Must を §1 に限定した。
- テスト全緑（209/2676）は現行 spec の範囲での回帰なしを意味するのみ。本書 §1 のとおり誤モック・未カバーで緑のままの実バグが複数ある。
- 認知負荷・変更容易性の測定は各スキルの規範に従った grep/churn 実測だが、優先度は履歴頻度による裏付けまでは取っていない箇所がある（A-3 §5 明記）。
- `packages/sheet-projection` の外部 consumer（trpg-remix-app）は未調査。
