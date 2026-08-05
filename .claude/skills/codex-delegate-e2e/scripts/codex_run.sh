#!/usr/bin/env bash
# codex_run.sh — Codex CLI を「ヘッドレスで安定して」呼び出すためのラッパー。
# (SKILL.md の実行コマンド契約をコード化したもの。Playwright E2E プロジェクトで実証した移植版)
#
# なぜこのラッパーが必要か:
#   素の `codex` は対話TUIを起動するため、非対話セッションでは入力待ちで固まる。
#   承認プロンプト・gitチェック・タイムアウト・一過性エラーが「不安定さ」の主因なので、
#   これらを一箇所に閉じ込めて毎回同じ安全な形で `codex exec` を叩く。
#
# 使い方:
#   codex_run.sh --mode review  --cd <dir> --prompt-file <f> [options]
#   codex_run.sh --mode code    --cd <dir> --prompt "…"       [options]
#   echo "指示文" | codex_run.sh --mode review --cd <dir>      # stdin から指示
#
# モード:
#   review : 読み取り専用 (--sandbox read-only)。レビュー/監査/調査向け。ファイルを一切変更しない。
#   code   : 書き込み可。--sandbox フラグは渡さず、trust 済み project の .codex/config.toml
#            (sandbox_mode = "danger-full-access") に委任する (この端末は workspace-write が恒常故障のため)。
#            OS による workspace 境界の強制は無い。事前に codex_doctor.sh --cd <dir> の preflight 必須。
#
# 主なオプション:
#   --mode <review|code>       (必須) 委譲の種類
#   --cd <dir>                  Codex を動かす作業ディレクトリ (既定: カレント)
#   --prompt "<text>"          指示文を直接渡す
#   --prompt-file <path>        指示文をファイルから渡す (長文はこちら推奨)
#   (どちらも無ければ stdin を指示文として読む)
#   --model <id>                モデル上書き (例: gpt-5-codex)。未指定なら Codex の既定
#   --timeout <sec>             全体タイムアウト秒 (既定: 1800。0 で無制限)
#   --retries <n>               一過性エラー時のリトライ回数 (既定: 2)
#   --out-dir <dir>             ログ/結果の出力先 (既定: 一時ディレクトリを自動生成)
#   --schema <path>             出力を JSON Schema に従わせる (--output-schema)。
#                               review モードの既定は references/review_schema.json、"none" で解除
#   --no-sandbox                --sandbox フラグを付けない (config.toml 委任)。この端末では
#                               read-only sandbox も間欠的に 1312 で故障するため、review が
#                               「全コマンド 1312」で空振りした時の再実行用 (レビュー用途限定。
#                               read-only の強制が消えるので、プロンプトの read-only 宣言が唯一の防壁)
#   --extra "<args>"            codex exec にそのまま渡す追加引数 (上級者向け)
#
# 終了コード:
#   0   成功
#   2   使い方エラー (引数不足など)
#   3   前提エラー (codex 未インストール / 未ログイン / schema 検証用 node 不在 / timeout コマンド不在)
#   65  schema 出力の受理拒否 (last_message が空・非 JSON・severity=high なのに verdict=pass)
#   66  sandbox helper 故障 (1312) を stderr に検出したため結果を受理拒否
#   124 タイムアウト
#   その他: codex exec の終了コードをそのまま返す
#
# 標準出力: Codex の最終メッセージ (レビュー結果や実装サマリ) のみを出す。
# 進捗ログ・JSONイベント・生ログは --out-dir 配下のファイルに保存する。

set -uo pipefail

log() { printf '[codex_run] %s\n' "$*" >&2; }
die() { log "ERROR: $1"; exit "${2:-1}"; }

# ---- 引数パース ----------------------------------------------------------
MODE=""
WORKDIR="$(pwd)"
PROMPT=""
PROMPT_FILE=""
MODEL="gpt-5.6-sol"   # この端末の契約既定 (CLI 0.144.1 で引数受理を確認済み)。--model で上書き可
EFFORT="xhigh"        # 実装・レビュー = xhigh / 軽い確認 = high 以下 (--effort で上書き)
TIMEOUT="1800"        # 0 で無制限 (長時間のバックグラウンド実装ラウンド用)
RETRIES="2"
OUT_DIR=""
SCHEMA=""
EXTRA=""
NO_SANDBOX=0
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

while [ $# -gt 0 ]; do
  case "$1" in
    # 値必須オプション: 値が無いまま shift 2 すると引数が進まず無限ループするため、先に存在を検査する
    --mode|--cd|--prompt|--prompt-file|--model|--effort|--timeout|--retries|--out-dir|--schema|--extra)
      [ $# -ge 2 ] || die "$1 には値が必要です" 2;;
  esac
  case "$1" in
    --mode)        MODE="$2"; shift 2;;
    --cd)          WORKDIR="$2"; shift 2;;
    --prompt)      PROMPT="$2"; shift 2;;
    --prompt-file) PROMPT_FILE="$2"; shift 2;;
    --model)       MODEL="$2"; shift 2;;
    --effort)      EFFORT="$2"; shift 2;;
    --timeout)     TIMEOUT="$2"; shift 2;;
    --retries)     RETRIES="$2"; shift 2;;
    --out-dir)     OUT_DIR="$2"; shift 2;;
    --schema)      SCHEMA="$2"; shift 2;;
    --no-sandbox)  NO_SANDBOX=1; shift;;
    --extra)       EXTRA="$2"; shift 2;;
    -h|--help)     sed -n '2,49p' "$0"; exit 0;;
    *) die "unknown option: $1" 2;;
  esac
done

# ---- バリデーション ------------------------------------------------------
case "$MODE" in
  review) SANDBOX="read-only";;
  # code は --sandbox を渡さない: この端末では workspace-write サンドボックスが
  # 恒常故障 (helper_unknown_error / 1312) のため、.codex/config.toml の
  # sandbox_mode = "danger-full-access" に委ねる (SKILL.md の契約参照)。
  code)   SANDBOX="";;
  *) die "--mode は review か code を指定してください (指定: '${MODE}')" 2;;
esac

# --no-sandbox: read-only sandbox が 1312 で故障する時の review 再実行用フォールバック。
if [ "$NO_SANDBOX" -eq 1 ]; then
  [ "$MODE" = "review" ] && log "注意: --no-sandbox のため read-only の OS 強制はありません。プロンプトの read-only 宣言だけが防壁です。"
  SANDBOX=""
fi

[ -d "$WORKDIR" ] || die "--cd のディレクトリが存在しません: $WORKDIR" 2

# review モードは構造化出力を既定にする (verdict 抽出を決定的にするため)。--schema none で解除。
if [ "$MODE" = "review" ] && [ -z "$SCHEMA" ]; then
  SCHEMA="$SCRIPT_DIR/../references/review_schema.json"
fi
[ "$SCHEMA" = "none" ] && SCHEMA=""
[ -z "$SCHEMA" ] || [ -f "$SCHEMA" ] || die "--schema のファイルが存在しません: $SCHEMA" 2

# schema 出力の検証 (JSON parse / verdict 整合) は node で行う。node 無しで進むと検証が
# fail-open になるため、schema を使う実行では前提エラーにする (検証不能時の黙認は事故のもと)。
if [ -n "$SCHEMA" ] && ! command -v node >/dev/null 2>&1; then
  die "node が見つかりません (schema 出力の検証に必須)。node を導入するか、構造化をやめる意図なら --schema none を明示してください。" 3
fi

# 同一 working tree への多重 writer (--mode code) を拒否する。read-only の review は同居可。
# lock は TMPDIR 側に置くので作業ツリーを汚さない。kill -9 等で残骸が残ったら
# エラーメッセージに出るパスを削除して再実行する。
LOCK_DIR=""
if [ "$MODE" = "code" ]; then
  # lock キーは working-tree root 単位で作る: 同じ repo をサブディレクトリ違いの --cd で
  # 指定しても同一 lock に衝突させる。git 管理外は共通ルートを機械的に確定できず、
  # サブディレクトリ指定で排他を回避できてしまうため fail-closed で拒否する。
  # repository 解決を上書きできる「セッション注入型」の Git 環境変数
  # (GIT_DIR / GIT_WORK_TREE / GIT_COMMON_DIR / GIT_CONFIG_COUNT+KEY/VALUE / GIT_CONFIG_PARAMETERS)
  # を除外して root を解決する。global / system config は遮断しない:
  # safe.directory 等の正当な設定が必要 (GIT_CONFIG_GLOBAL=/dev/null はこの端末で dubious
  # ownership を誘発し正当な code モードまで誤拒否することを実測済み)。config ファイルを
  # 書き換えられる主体は lock ディレクトリも直接消せるため、その経路は脅威モデル外。
  # 脅威モデル注記: この lock は「うっかり二重起動」を防ぐアドバイザリ機構であり、
  # セキュリティ境界ではない。敵対的な呼び出し元の遮断は目的にしない。
  WORKROOT="$(env -u GIT_DIR -u GIT_WORK_TREE -u GIT_COMMON_DIR \
                  -u GIT_CONFIG_COUNT -u GIT_CONFIG_PARAMETERS \
                  git -C "$WORKDIR" rev-parse --show-toplevel 2>/dev/null)" || WORKROOT=""
  [ -n "$WORKROOT" ] || die "code モードは git 管理下のディレクトリ限定です (git 外は writer lock の単位を確定できない): $WORKDIR" 2
  # 正規化して WORKDIR が WORKROOT 自身またはその配下であることも検証する (belt-and-braces)。
  # Windows Git Bash では git が C:/ 形式、シェルが /c/ 形式を返すため cygpath で形式を揃える。
  norm_path() {
    p="$1"
    command -v cygpath  >/dev/null 2>&1 && p="$(cygpath -u "$p" 2>/dev/null || printf '%s' "$p")"
    command -v realpath >/dev/null 2>&1 && p="$(realpath "$p" 2>/dev/null || printf '%s' "$p")"
    printf '%s' "$p"
  }
  WORKROOT_N="$(norm_path "$WORKROOT")"
  WORKDIR_N="$(norm_path "$WORKDIR")"
  # root が "/" のときはパターンが "//*" になり配下を誤拒否するので、全パスが配下として扱う
  if [ "$WORKROOT_N" != "/" ]; then
    case "$WORKDIR_N/" in
      "$WORKROOT_N"/*) : ;;
      *) die "--cd が working-tree root の配下ではありません (root: $WORKROOT_N, cd: $WORKDIR_N)" 2;;
    esac
  fi
  WORKKEY="$(printf '%s' "$WORKROOT_N" | cksum | cut -d' ' -f1)"
  LOCK_DIR="${TMPDIR:-/tmp}/codex-delegate-writer-$WORKKEY.lock"
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    printf '%s\n' "$$" > "$LOCK_DIR/pid"
    # 競合時に持ち主を即特定できるよう所有者情報を残す (~/.codex/sessions の rollout と突き合わせ可能)
    printf 'mode=%s cd=%s started=%s\n' "$MODE" "$WORKDIR" "$(date '+%Y-%m-%dT%H:%M:%S%z' 2>/dev/null || echo '?')" > "$LOCK_DIR/info" 2>/dev/null || true
  else
    die "この working tree には既に writer (--mode code) が実行中です (pid: $(cat "$LOCK_DIR/pid" 2>/dev/null || echo '?') / $(cat "$LOCK_DIR/info" 2>/dev/null || echo 'info なし'))。持ち主 pid が生存しているなら並行セッションの正当な委譲かもしれない — 消さず・殺さず、由来を特定すること。pid 死亡の残骸のみ削除して再実行: $LOCK_DIR" 2
  fi
fi
trap '[ -n "${TMP_PROMPT:-}" ] && rm -f "$TMP_PROMPT"; [ -n "${LOCK_DIR:-}" ] && rm -rf "$LOCK_DIR"' EXIT

case "$TIMEOUT" in ''|*[!0-9]*) die "--timeout は整数秒で指定してください: $TIMEOUT" 2;; esac
case "$RETRIES" in ''|*[!0-9]*) die "--retries は整数で指定してください: $RETRIES" 2;; esac

# ---- 前提チェック (preflight) -------------------------------------------
command -v codex >/dev/null 2>&1 || die "codex コマンドが見つかりません。Codex CLI をインストールしてください。" 3

# ログイン状態を確認 (未ログインだと exec が即失敗して"不安定"に見える)。
# 注意: 古い CLI は `login status` 自体が無い。「明確に未ログイン」のときだけ致命扱いにし、
# 判定不能 (未実装等) なら警告して続行する (偽陰性で弾かないため)。
if codex login status >/dev/null 2>&1; then
  :
elif [ -n "${CODEX_API_KEY:-}" ] || [ -n "${OPENAI_API_KEY:-}" ]; then
  log "ログイン未確認だが API キーが設定されているので続行します。"
else
  LOGIN_OUT="$(codex login status 2>&1 || true)"
  if printf '%s\n' "$LOGIN_OUT" | grep -qiE 'not logged in|logged out|no credentials|please log ?in'; then
    die "Codex に未ログインです。'codex login' を実行するか CODEX_API_KEY を設定してください。" 3
  else
    log "認証状態を確認できませんでした (古いCLIの可能性)。そのまま実行を試みます: ${LOGIN_OUT}"
  fi
fi

# project 側 .codex/config.toml は「trust された project」でのみ読まれる (SKILL.md preflight 参照)。
# trust が無いと code モードは既定 sandbox に落ち、この端末では helper_unknown_error / 1312 になる。
# パス表記差 (C:\ と /c/) で機械照合が偽陰性になり得るため、ここでは警告に留める。
# 確定判定は codex_doctor.sh --cd <dir> の実効 sandbox プローブで行う。
if [ "$MODE" = "code" ] && [ -f "$WORKDIR/.codex/config.toml" ]; then
  USER_CFG="${CODEX_HOME:-$HOME/.codex}/config.toml"
  if ! grep -qs 'trust_level *= *"trusted"' "$USER_CFG" 2>/dev/null; then
    log "警告: ~/.codex/config.toml に trust_level=\"trusted\" が見当たりません。project config (danger-full-access) が無視される恐れ。'codex_doctor.sh --cd $WORKDIR' で実効 sandbox を確認してください。"
  fi
fi

# --ask-for-approval のサポート確認。
# 古い版の `codex exec` はこのフラグ自体が無い (exec は常に非対話) ため、
# 無条件に付けると "unknown argument" で毎回即死する。対応している時だけ付与する。
APPROVAL=""
if codex exec --help 2>&1 | grep -q -- '--ask-for-approval'; then
  APPROVAL="--ask-for-approval never"
else
  log "この codex exec は --ask-for-approval 非対応 (常に非対話)。フラグ無しで続行します。"
fi

# ---- 指示文の解決 --------------------------------------------------------
# 優先度: --prompt-file > --prompt > stdin
TMP_PROMPT=""
if [ -n "$PROMPT_FILE" ]; then
  [ -f "$PROMPT_FILE" ] || die "--prompt-file が存在しません: $PROMPT_FILE" 2
  PROMPT_SRC="$PROMPT_FILE"
elif [ -n "$PROMPT" ]; then
  PROMPT_SRC="$(mktemp)"; TMP_PROMPT="$PROMPT_SRC"; printf '%s' "$PROMPT" > "$PROMPT_SRC"
elif [ ! -t 0 ]; then
  PROMPT_SRC="$(mktemp)"; TMP_PROMPT="$PROMPT_SRC"; cat > "$PROMPT_SRC"
else
  die "指示文がありません。--prompt / --prompt-file / stdin のいずれかで渡してください。" 2
fi
# 一時プロンプトの後始末は冒頭の EXIT trap (lock 解放と共通) が行う (ユーザーのファイルは消さない)
[ -s "$PROMPT_SRC" ] || die "指示文が空です。" 2

# ---- 出力先の準備 --------------------------------------------------------
if [ -z "$OUT_DIR" ]; then
  OUT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/codex-delegate.XXXXXX")" || die "一時 out-dir の作成に失敗しました (TMPDIR を確認): ${TMPDIR:-/tmp}" 3
fi
mkdir -p "$OUT_DIR" || die "--out-dir を作成できません: $OUT_DIR" 2
[ -d "$OUT_DIR" ] || die "--out-dir がディレクトリではありません: $OUT_DIR" 2
EVENTS_LOG="$OUT_DIR/events.jsonl"    # --json の生イベント
LAST_MSG="$OUT_DIR/last_message.txt"  # 最終メッセージ
RUN_LOG="$OUT_DIR/run.log"            # stderr 全体

# ---- timeout コマンドの検出 ---------------------------------------------
TIMEOUT_BIN=""
if command -v timeout >/dev/null 2>&1; then TIMEOUT_BIN="timeout"
elif command -v gtimeout >/dev/null 2>&1; then TIMEOUT_BIN="gtimeout"  # macOS (coreutils)
elif [ "$TIMEOUT" -gt 0 ]; then
  # 黙ってタイムアウト無しに落ちると「プロセス終了＝完了条件」の契約を破り、永久ハングし得る。
  die "timeout/gtimeout が見つかりません。coreutils を導入するか、無制限を意図するなら --timeout 0 を明示してください。" 3
else
  log "--timeout 0 指定のためタイムアウト制御なしで実行します。"
fi

# ---- codex exec コマンドの組み立て --------------------------------------
# 安定化の要点:
#   exec                    : 非対話モード。TUI を起動しないので固まらない。
#   --ask-for-approval never: 承認待ちで無限に止まらない (ヘッドレス必須)。
#   --sandbox <mode>        : review=read-only を明示付与。code は付けず project config の
#                             danger-full-access へ委任 (workspace 境界の OS 強制は無い)。
#   --skip-git-repo-check   : git 管理外でも "not a git repo" で落ちない。
#   --json / -o             : 進捗は JSONL、最終結果はファイルへ確実に回収。
build_cmd() {
  set -- codex exec
  set -- "$@" --cd "$WORKDIR"
  # SANDBOX が空 (code モード) のときはフラグ自体を付けず config.toml に委ねる
  [ -n "$SANDBOX" ] && set -- "$@" --sandbox "$SANDBOX"
  # APPROVAL は "--ask-for-approval never" か空。空白区切りの意図的な展開。
  # shellcheck disable=SC2086
  [ -n "$APPROVAL" ] && set -- "$@" $APPROVAL
  set -- "$@" --skip-git-repo-check
  set -- "$@" --json
  set -- "$@" --output-last-message "$LAST_MSG"
  [ -n "$MODEL" ]  && set -- "$@" --model "$MODEL"
  [ -n "$EFFORT" ] && set -- "$@" -c "model_reasoning_effort=$EFFORT"
  [ -n "$SCHEMA" ] && set -- "$@" --output-schema "$SCHEMA"
  # --extra は空白区切りでそのまま展開 (上級者向け・信頼できる値のみ)
  # shellcheck disable=SC2086
  [ -n "$EXTRA" ] && set -- "$@" $EXTRA
  # 指示文は stdin から (`-`) 渡す。引数長やクォート事故を避けるため。
  set -- "$@" -
  printf '%s\0' "$@"
}

run_once() {
  # コマンド配列を NUL 区切りで復元して実行
  local -a cmd=()
  while IFS= read -r -d '' part; do cmd+=("$part"); done < <(build_cmd)

  # RUN_LOG は試行ごとに空にする (前回の一過性エラー行が残っていると
  # is_transient の grep が汚染され、認証エラー等を誤って再試行してしまう)。
  # 全試行の履歴は run.all.log に蓄積する。
  : > "$EVENTS_LOG"; : > "$LAST_MSG"; : > "$RUN_LOG"
  local rc=0
  if [ -n "$TIMEOUT_BIN" ] && [ "$TIMEOUT" -gt 0 ]; then
    # --preserve-status は使わない: 付けるとタイムアウト時に 143 が返り、
    # 124 を見て「タイムアウト＝一過性」と判定するロジックが壊れる。
    # -k 10 で TERM を無視するプロセスも 10s 後に KILL する。
    "$TIMEOUT_BIN" -k 10 "$TIMEOUT" \
      "${cmd[@]}" < "$PROMPT_SRC" > "$EVENTS_LOG" 2>> "$RUN_LOG" || rc=$?
  else
    "${cmd[@]}" < "$PROMPT_SRC" > "$EVENTS_LOG" 2>> "$RUN_LOG" || rc=$?
  fi
  cat "$RUN_LOG" >> "$OUT_DIR/run.all.log" 2>/dev/null || true
  return "$rc"
}

# ---- 一過性エラー判定 ----------------------------------------------------
# 認証・引数・スキーマ違反など「何度やっても同じ」ものはリトライしない。
is_transient() {
  local rc="$1"
  [ "$rc" -eq 124 ] && return 0   # タイムアウト
  # ログに一過性の兆候があるか
  if grep -qiE 'rate limit|429|timeout|timed out|temporarily|ECONNRESET|ETIMEDOUT|503|502|500 Internal|network' "$RUN_LOG" 2>/dev/null; then
    return 0
  fi
  # 認証エラーは非一過性
  if grep -qiE 'unauthorized|401|not logged in|invalid api key|authentication' "$RUN_LOG" 2>/dev/null; then
    return 1
  fi
  return 1
}

# ---- 実行 (リトライ付き) -------------------------------------------------
log "mode=$MODE sandbox=${SANDBOX:-config.toml委任} model=$MODEL effort=$EFFORT cd=$WORKDIR timeout=${TIMEOUT}s retries=$RETRIES"
log "logs -> $OUT_DIR"

attempt=0
rc=0
while : ; do
  attempt=$((attempt+1))
  log "codex exec 試行 $attempt ..."
  run_once
  rc=$?
  if [ "$rc" -eq 0 ]; then
    log "成功 (試行 $attempt)"
    break
  fi
  log "codex exec が rc=$rc で終了 (試行 $attempt)。詳細: $RUN_LOG"
  if grep -qiE 'helper_unknown_error|1312' "$RUN_LOG" "$EVENTS_LOG" 2>/dev/null; then
    log "ヒント: helper_unknown_error/1312 を検出。workspace-write sandbox 故障、または project config が trust されていない疑い (SKILL.md の preflight 参照)。"
  fi
  if [ "$attempt" -gt "$RETRIES" ]; then
    log "リトライ上限に達しました。"
    break
  fi
  if is_transient "$rc"; then
    backoff=$(( 5 * (1 << (attempt - 1)) ))  # 指数バックオフ: 5s, 10s, 20s, ...
    log "一過性エラーと判断。${backoff}s 待って再試行します。"
    sleep "$backoff"
  else
    log "非一過性エラー (認証/引数/スキーマ等)。リトライせず中断します。"
    break
  fi
done

# ---- sandbox helper 故障 (1312) の検出 ------------------------------------
# 1312 は Codex 自体が rc=0 のまま内部コマンドだけを全滅させることがある (2026-07-18 実測)。
# OS エラーの署名は stderr (RUN_LOG) にだけ出る。モデルが読んだファイル内容や指示文は
# events / last_message 側に落ちるため、stderr 限定の走査ならコンテンツ起因の誤検出をしない。
if [ "$rc" -eq 0 ] && grep -qE 'CreateProcessAsUserW failed|helper_unknown_error' "$RUN_LOG" 2>/dev/null; then
  log "sandbox helper 故障 (1312) を stderr に検出。内部コマンドが失敗したまま完走した疑いがあるため、この結果は受理しません。review 用途なら --no-sandbox で再実行してください。"
  exit 66
fi

# ---- 結果の取り出し ------------------------------------------------------
if [ "$rc" -eq 0 ]; then
  if [ -n "$SCHEMA" ]; then
    # schema 指定時は fail-closed: 空・非 JSON・verdict 整合違反 (severity=high があるのに
    # verdict=pass) はすべて受理拒否。node は preflight で存在保証済み。
    if [ ! -s "$LAST_MSG" ]; then
      log "schema 指定なのに last_message が空です。受理できません。events を確認: $EVENTS_LOG"
      exit 65
    fi
    if ! node -e '
      let m;
      try { m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); }
      catch (e) { console.error("last_message が JSON として不正: " + e.message); process.exit(1); }
      if (m && typeof m === "object" && "verdict" in m && Array.isArray(m.findings)) {
        const high = m.findings.filter(f => f && f.severity === "high").length;
        if (high > 0 && m.verdict === "pass") { console.error("severity=high が " + high + " 件あるのに verdict=pass"); process.exit(1); }
      }' "$LAST_MSG"; then
      log "schema 出力の検証に失敗。この結果を受理しないでください: $LAST_MSG"
      exit 65
    fi
    cat "$LAST_MSG"
  elif [ -s "$LAST_MSG" ]; then
    cat "$LAST_MSG"
  else
    log "last_message が空でした。events.jsonl を確認してください: $EVENTS_LOG"
  fi
fi

exit "$rc"
