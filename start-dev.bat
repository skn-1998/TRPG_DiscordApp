@echo off
echo ========================================
echo Next app dev server (port 3100)
echo ========================================
echo.

set "SCRIPT_DIR=%~dp0"
set "NEXT_APP_DIR=%SCRIPT_DIR%trpg-next-app"

if not exist "%NEXT_APP_DIR%" (
    echo [ERROR] trpg-next-app directory not found: %NEXT_APP_DIR%
    pause
    exit /b 1
)

cd /d "%SCRIPT_DIR%"
if errorlevel 1 (
    echo [ERROR] Failed to change directory: %SCRIPT_DIR%
    pause
    exit /b 1
)

echo Workspace: %CD%
echo Command: pnpm --filter trpg-next-app run dev
echo.
echo ========================================
echo.

pnpm --filter trpg-next-app run dev

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start the dev server
    echo If ERR_PNPM_VERIFY_DEPS_BEFORE_RUN, run: pnpm install
    pause
    exit /b 1
)