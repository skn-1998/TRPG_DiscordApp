@echo off
chcp 65001 >nul
echo ========================================
echo Remixアプリ開発サーバー起動
echo ========================================
echo.

REM バッチファイルのディレクトリパスを取得
set "SCRIPT_DIR=%~dp0"
set "REMIX_APP_DIR=%SCRIPT_DIR%trpg-remix-app"

REM ディレクトリの存在確認
if not exist "%REMIX_APP_DIR%" (
    echo [エラー] trpg-remix-app ディレクトリが見つかりません: %REMIX_APP_DIR%
    pause
    exit /b 1
)

REM trpg-remix-appディレクトリに移動
cd /d "%REMIX_APP_DIR%"
if errorlevel 1 (
    echo [エラー] ディレクトリへの移動に失敗しました: %REMIX_APP_DIR%
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

