# Codex CLI フラグ早見表（非対話運用）

出典: OpenAI Codex 公式ドキュメント（noninteractive / CLI reference / sandboxing）。
CLI のバージョンでフラグ名が変わることがあるので、疑わしいときは `codex exec --help` で実機確認する。

## 基本形

```bash
codex exec [FLAGS] "PROMPT"        # 引数でプロンプト
codex exec [FLAGS] -               # stdin からプロンプト（推奨: 長文・多言語で安全）
codex e   [FLAGS] ...              # exec の別名
```

## 非対話で安定させる中核フラグ

| フラグ | 役割 | このスキルでの既定 |
|---|---|---|
| `--ask-for-approval never`（`-a never`） | 承認待ちを無効化。ヘッドレスで固まらない | 対応版のみ自動付与※ |
| `--sandbox read-only`（`-s`） | ファイル変更禁止。レビュー/監査向け | review モード |
| `--sandbox workspace-write` | 作業ディレクトリ内のみ書き込み可 | **この端末では使わない**（恒常故障 1312。troubleshooting §10） |
| `--sandbox danger-full-access` | 無制限 | code モードは**フラグを渡さず** project `.codex/config.toml` のこの設定に委任 |
| `--skip-git-repo-check` | git 管理外でも実行を許可 | 常に付与 |
| `--cd <dir>`（`-C`） | 作業ディレクトリを指定 | `--cd` |
| `--json` | 進捗を JSONL イベントで出力（stdout） | 常に付与（ログ回収用） |
| `--output-last-message <path>`（`-o`） | 最終メッセージをファイルへ | 常に付与 |
| `--output-schema <path>` | 出力を JSON Schema に従わせる | review モードは既定付与（`--schema none` で解除）。他は `--schema` 指定時 |
| `--model <id>`（`-m`） | モデル上書き | `--model` 指定時 |
| `--ephemeral` | セッションファイルを残さない | 任意（`--extra`） |
| `--ignore-user-config` | `~/.codex/config.toml` を無視（CI で環境差を排除） | 任意（`--extra`） |
| `--add-dir <dir>` | 書き込み許可ディレクトリを追加 | 任意（`--extra`） |

※ 古い版の `codex exec` はこのフラグ自体を持たない（exec は常に非対話）。ラッパーは
`codex exec --help` を見て対応時のみ付与するので、版差で "unknown argument" 即死しない。

## 承認モード（`--ask-for-approval`）

- `never` … 一切止まらない。**非対話/委譲はこれ。**
- `on-request` … コマンドごとに確認（対話ローカル開発向け）。
- `untrusted` … 常に承認要求。

## サンドボックス方針の対応

| モード | 変更 | このスキルでの扱い |
|---|---|---|
| `read-only` | 不可 | review モード（レビュー・監査・調査・設計相談） |
| `workspace-write` | 作業ディレクトリ内のみ | **この端末では恒常故障（helper_unknown_error / 1312）のため使わない** |
| `danger-full-access` | 無制限 | code モードの実効値。CLI フラグでは渡さず、trust 済み project の `.codex/config.toml`（`sandbox_mode = "danger-full-access"`）に委任する（正本 SKILL.md の preflight 参照） |

## 認証

```bash
codex login                 # ChatGPT ログイン（ローカル個人利用）
codex login --with-api-key  # stdin から API キー（自動化）
codex login status          # 現在の認証状態
CODEX_API_KEY=... codex exec ...   # 単発呼び出しにキーをスコープ（ジョブ全体の env には置かない）
```

## セッション再開

```bash
codex exec resume --last "続きの指示"   # 直近セッションを継続
codex exec resume <SESSION_ID>          # 特定セッションを継続
```
