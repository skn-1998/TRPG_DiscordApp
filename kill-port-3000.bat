@echo off
chcp 65001 >nul
echo ========================================
echo ポート3000使用プロセス終了ツール
echo ========================================
echo.

REM ポート3000を使用しているプロセスを検索
echo ポート3000を使用しているプロセスを検索中...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    set PID=%%a
    goto :found
)

echo ポート3000を使用しているプロセスは見つかりませんでした。
goto :end

:found
echo.
echo 発見: PID %PID% がポート3000を使用しています
echo プロセスを終了しています...
taskkill /F /PID %PID%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✓ プロセス (PID: %PID%) を正常に終了しました
) else (
    echo.
    echo × プロセスの終了に失敗しました
    echo   管理者権限で実行してください
)

:end
echo.
echo ========================================
pause
