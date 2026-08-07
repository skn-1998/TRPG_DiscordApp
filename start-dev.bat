@echo off
chcp 65001 >nul
echo ========================================
echo Next アプリ開発サーバー起動 (port 3100)
echo ========================================
echo.

REM バッチファイルのディレクトリパスを取得
set "SCRIPT_DIR=%~dp0"
set "NEXT_APP_DIR=%SCRIPT_DIR%trpg-next-app"

REM ディレクトリの存在確認
if not exist "%NEXT_APP_DIR%" (
    echo [エラー] trpg-next-app ディレクトリが見つかりません: %NEXT_APP_DIR%
    pause
    exit /b 1
)

REM trpg-next-appディレクトリに移動
cd /d "%NEXT_APP_DIR%"
if errorlevel 1 (
    echo [エラー] ディレクトリへの移動に失敗しました: %NEXT_APP_DIR%
    pause
    exit /b 1
)

echo ディレクトリ: %CD%
echo コマンド: pnpm run dev
echo.
echo ========================================
echo.

REM pnpm run devを実行
pnpm run dev

REM エラーが発生した場合
if errorlevel 1 (
    echo.
    echo [エラー] 開発サーバーの起動に失敗しました
    pause
    exit /b 1
)
