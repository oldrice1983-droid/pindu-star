@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================================
echo   FORCE push - use this only if GO-push.bat says
echo   "failed to push some refs"
echo ============================================================
echo.
echo   This overwrites anything already on GitHub with your local copy.
echo   The repo should be empty, so nothing will be lost.
echo.
echo   Press any key to continue, or close this window to cancel...
pause >nul

set "GIT="
where git >nul 2>&1 && set "GIT=git"
if not defined GIT if exist "C:/Program Files/Git/cmd/git.exe" set "GIT=C:/Program Files\Git\cmd\git.exe"
if not defined GIT if exist "C:/Program Files/Git/bin/git.exe" set "GIT=C:/Program Files\Git\bin\git.exe"
if not defined GIT if exist "%USERPROFILE%\.workbuddy\binaries\PortableGit\versions\1.2.0\mingw64\bin\git.exe" set "GIT=%USERPROFILE%\.workbuddy\binaries\PortableGit\versions\1.2.0\mingw64\bin\git.exe"
if not defined GIT for /d %%A in ("%USERPROFILE%\.workbuddy\binaries\PortableGit\*") do if not defined GIT for /d %%B in ("%%~fA\*") do if exist "%%~fB\mingw64\bin\git.exe" set "GIT=%%~fB\mingw64\bin\git.exe"
if not defined GIT (
  echo   ERROR: git.exe not found.
  pause
  exit /b 1
)

echo.
echo git OK
echo !GIT!
echo.
echo Force pushing...
"!GIT!" push -u origin main --force
set "RC=%errorlevel%"
echo.
if "%RC%"=="0" (
  echo   FORCE PUSH OK
  echo.
  echo   Go to: https://github.com/oldrice1983-droid/pindu-star/actions
  echo   Then run the build workflow.
) else (
  echo   STILL FAILED - exit code %RC%
  echo   Copy the message above this line and send it to me.
)
echo.
pause
