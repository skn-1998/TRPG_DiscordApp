#!/usr/bin/env bash
# codex_doctor.sh — Codex 委譲まわりの「なぜ不安定か」を切り分ける健康診断スクリプト。
#
# 委譲が安定しない時、原因はだいたい次のどれか:
#   1) codex 未インストール / PATH 外
#   2) 未ログイン or 認証情報の期限切れ
#   3) 対話TUIを起動していて固まる (exec を使っていない)
#   4) 承認プロンプト待ちで停止 (--ask-for-approval never を付けていない)
#   5) sandbox 権限エラー / git チェックで落ちる
#   6) タイムアウト無しで長時間ハング
#
# このスクリプトは 1,2,5 を実測し、3,4,6 は設定を点検して指摘する。
# 破壊的な操作はしない設計だが、強制力は診断ごとに異なる:
#   診断4 = read-only sandbox の最小 exec (OS 強制あり)
#   診断5 = --sandbox 無しの最小 exec (OS 強制なし。プロンプトの read-only 指示のみが防壁。
#            対象 project に AI 向けの自動実行指示があると理論上は書き込みが起き得る)

set -uo pipefail
ok()   { printf '  \033[32m✔\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m▲\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✘\033[0m %s\n' "$*"; }
hdr()  { printf '\n\033[1m%s\033[0m\n' "$*"; }

ISSUES=0
note_issue() { ISSUES=$((ISSUES+1)); }

# --cd <dir> : code モード委譲の対象ディレクトリ。指定すると、その場所で
# --sandbox を渡さない code モードと同条件のプローブを実行し、実効 sandbox が
# danger-full-access になっているか (= project config が trust されて有効か) を機械確認する。
TARGET_CD=""
while [ $# -gt 0 ]; do
  case "$1" in
    --cd)
      # 値が無いまま shift 2 すると引数が進まず無限ループするため先に検査する
      [ $# -ge 2 ] || { bad "--cd には値が必要です"; exit 2; }
      TARGET_CD="$2"; shift 2;;
    *) bad "unknown option: $1 (対応: --cd <dir>)"; exit 2;;
  esac
done

hdr "1. codex の存在と PATH"
if command -v codex >/dev/null 2>&1; then
  ok "codex: $(command -v codex)"
  ver="$(codex --version 2>/dev/null | head -n1)"
  [ -n "$ver" ] && ok "version: $ver" || warn "バージョン取得に失敗 (codex --version)"
else
  bad "codex が PATH にありません。インストール/PATH を確認してください。"
  note_issue
  printf '\n診断終了: codex が無いと他の項目は検査できません。\n'
  exit 1
fi

hdr "2. 認証状態"
if codex login status >/dev/null 2>&1; then
  ok "codex login status: ログイン済み"
elif [ -n "${CODEX_API_KEY:-}" ]; then
  ok "CODEX_API_KEY が設定されています"
elif [ -n "${OPENAI_API_KEY:-}" ]; then
  warn "OPENAI_API_KEY はあるが CODEX_API_KEY 未設定。CLI 版によっては CODEX_API_KEY を推奨。"
else
  bad "未ログインの可能性。'codex login' か CODEX_API_KEY 設定が必要。これが不安定の典型原因です。"
  note_issue
fi

hdr "3. 設定ファイル (~/.codex/config.toml)"
CFG="${CODEX_HOME:-$HOME/.codex}/config.toml"
if [ -f "$CFG" ]; then
  ok "config.toml あり: $CFG"
  if grep -qiE 'approval|ask.?for.?approval' "$CFG" 2>/dev/null; then
    warn "config に approval 設定あり。CLI 引数の --ask-for-approval never と食い違うと予期せぬ停止の元。中身を確認推奨。"
  fi
else
  warn "config.toml が無い (既定動作)。ラッパー側で毎回フラグ指定するので通常は問題なし。"
fi

hdr "4. exec (非対話) の実測"
# 破壊しない最小の read-only exec。TUI/承認/権限の実挙動をここで確認する。
TMPD="$(mktemp -d)"
LASTMSG="$TMPD/last.txt"
TO="60"
TIMEOUT_BIN=""
command -v timeout >/dev/null 2>&1 && TIMEOUT_BIN="timeout"
command -v gtimeout >/dev/null 2>&1 && TIMEOUT_BIN="gtimeout"
SKIP_PROBES=0
if [ -z "$TIMEOUT_BIN" ]; then
  # timeout 無しの probe は認証先やネットワーク停止時に永久に戻らないので実行しない
  bad "timeout/gtimeout が無い。無制限ハングを防げないため probe (診断4・5) はスキップ。coreutils を導入して再実行すること。"
  note_issue
  SKIP_PROBES=1
fi

# 古い codex exec は --ask-for-approval を受け付けない (常に非対話)。対応時のみ付ける。
APPROVAL=""
if codex exec --help 2>&1 | grep -q -- '--ask-for-approval'; then
  APPROVAL="--ask-for-approval never"
  ok "codex exec は --ask-for-approval に対応"
else
  warn "この codex exec は --ask-for-approval 非対応 (常に非対話)。フラグ無しで検査します。"
fi

if [ "$SKIP_PROBES" -eq 1 ]; then
  warn "probe スキップ (timeout コマンドなし)"
else
  rc=0
  # APPROVAL の空白区切り展開は意図的。--preserve-status は使わない (timeout時に 124 が返らなくなる)。
  # shellcheck disable=SC2086
  echo "Reply with exactly: CODEX_OK. Do not run any commands. Do not modify any files." | \
    "$TIMEOUT_BIN" -k 10 "$TO" \
    codex exec --cd "$TMPD" --sandbox read-only $APPROVAL \
      --skip-git-repo-check --output-last-message "$LASTMSG" - \
      > "$TMPD/events.log" 2> "$TMPD/err.log" || rc=$?

  if [ "$rc" -eq 0 ]; then
    ok "codex exec が正常終了 (rc=0)"
    if grep -q "CODEX_OK" "$LASTMSG" 2>/dev/null; then
      ok "モデル応答も取得できました (last_message OK)"
    else
      warn "終了は成功だが最終メッセージが想定外。$LASTMSG を確認。"
    fi
  elif [ "$rc" -eq 124 ]; then
    bad "exec が ${TO}s でタイムアウト。承認待ち/ネットワーク/モデル遅延の疑い。err.log: $TMPD/err.log"
    note_issue
  else
    bad "exec が rc=$rc で失敗。err.log を確認: $TMPD/err.log"
    note_issue
    tail -n 5 "$TMPD/err.log" 2>/dev/null | sed 's/^/      /'
  fi
fi

hdr "5. 実効 sandbox の機械確認 (code モード条件・--cd 指定時)"
if [ -n "$TARGET_CD" ]; then
  if [ "$SKIP_PROBES" -eq 1 ]; then
    warn "probe スキップ (timeout コマンドなし)。実効 sandbox は未確認のまま。"
  elif [ -d "$TARGET_CD" ]; then
    SBXLOG="$TMPD/sandbox-probe.log"
    rc2=0
    # code モードと同条件 (--sandbox を渡さない・--json を付けない)。非 json の起動ヘッダーに
    # 実効 sandbox が出るのでそれを判定する。注意: この probe には OS の read-only 強制が無い
    # (プロンプトの禁止指示のみが防壁)。header 判定が目的なので指示は最小にする。
    # shellcheck disable=SC2086
    echo "Reply with exactly: OK. Do not run any commands. Do not modify any files." | \
      "$TIMEOUT_BIN" -k 10 120 \
      codex exec --cd "$TARGET_CD" $APPROVAL --skip-git-repo-check - \
      > "$SBXLOG" 2>&1 || rc2=$?
    if grep -qiE 'sandbox:? *danger.full.access' "$SBXLOG"; then
      ok "実効 sandbox = danger-full-access (project config が有効。code モード委譲可)"
    else
      DETECTED="$(grep -ioE 'sandbox:? *[a-z-]+' "$SBXLOG" | head -n1)"
      bad "実効 sandbox が danger-full-access ではありません (検出: ${DETECTED:-不明, rc=$rc2})。project が trust されていない疑い。~/.codex/config.toml の projects trust_level を設定してから委譲すること。ログ: $SBXLOG"
      note_issue
    fi
  else
    bad "--cd のディレクトリが存在しません: $TARGET_CD"
    note_issue
  fi
else
  warn "--cd 未指定のためスキップ。code モード委譲の前は 'codex_doctor.sh --cd <対象dir>' で実効 sandbox を確認すること。"
fi

hdr "結果サマリ"
if [ "$ISSUES" -eq 0 ]; then
  ok "重大な問題は検出されませんでした。codex_run.sh 経由の委譲は安定して動くはずです。"
else
  bad "$ISSUES 件の要対応項目があります。上記 ✘ を潰すと安定します。"
fi
printf '生ログ: %s\n' "$TMPD"
exit "$ISSUES"
