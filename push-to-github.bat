@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================================
echo   Pindu Star - Push to GitHub and build IPA
echo ============================================================
echo.

rem ---------- locate git.exe ----------
set "GIT="
where git >nul 2>&1 && set "GIT=git"

if not defined GIT if exist "C:\Program Files\Git\cmd\git.exe" set "GIT=C:\Program Files\Git\cmd\git.exe"
if not defined GIT if exist "C:\Program Files\Git\bin\git.exe" set "GIT=C:\Program Files\Git\bin\git.exe"
if not defined GIT if exist "C:\Program Files (x86)\Git\cmd\git.exe" set "GIT=C:\Program Files (x86)\Git\cmd\git.exe"
if not defined GIT if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" set "GIT=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"

rem PortableGit style: <root>\<anything>\<anything>\mingw64\bin\git.exe
if not defined GIT (
  for /d %%A in ("%USERPROFILE%\.workbuddy\binaries\PortableGit\*") do (
    if not defined GIT for /d %%B in ("%%~fA\*") do (
      if exist "%%~fB\mingw64\bin\git.exe" set "GIT=%%~fB\mingw64\bin\git.exe"
      if not exist "%%~fB\mingw64\bin\git.exe" if exist "%%~fB\cmd\git.exe" set "GIT=%%~fB\cmd\git.exe"
      if not exist "%%~fB\cmd\git.exe" if exist "%%~fB\bin\git.exe" set "GIT=%%~fB\bin\git.exe"
    )
  )
)

rem Fallback: anywhere on C for a cmd\git.exe (slow but last resort)
if not defined GIT (
  for /d %%C in ("C:\Program Files*") do (
    if not defined GIT for /d %%D in ("%%~fC\Git") do (
      if exist "%%~fD\cmd\git.exe" set "GIT=%%~fD\cmd\git.exe"
    )
  )
)

if not defined GIT (
  echo   ERROR: git.exe was not found.
  echo.
  echo   Your PATH does not include Git for Windows.
  echo.
  echo   FIX - do one of these:
  echo.
  echo   Option A (fastest): install Git for Windows
  echo      1. Open:  https://git-scm.com/download/win
  echo      2. Download and run the installer, accept defaults
  echo      3. Restart this window, run this file again
  echo.
  echo   Option B: add it to PATH manually
  echo      1. Press Win+S, search "environment variables"
  echo      2. Click "Edit the system environment variables"
  echo      3. Under "User variables" click "Edit"
  echo      4. Add the folder that contains git.exe
  echo   ============================================================
  echo.
  pause
  exit /b 1
)

echo   git located OK
echo   !GIT!
echo.

echo   Checking remote repo...
"!GIT!" ls-remote --exit-code origin HEAD >nul 2>&1
if errorlevel 1 (
  echo.
  echo  ============================================================
  echo   [STOP] The GitHub repo does not exist yet.
  echo  ============================================================
  echo.
  echo   Do this FIRST in your browser:
  echo.
  echo     1. Open:  https://github.com/new
  echo     2. Repository name:  pindu-star
  echo     3. Visibility:  Public      ^<-- MUST be Public
  echo     4. Leave README / .gitignore / license UNCHECKED
  echo     5. Click the green "Create repository" button
  echo.
  echo   Then run this file again.
  echo.
  pause
  exit /b 1
)
echo   Repo found. Ready to push.
echo.

echo   Press any key to push...
pause >nul

echo.
echo Pushing...
"!GIT!" push -u origin main
set "RC=%errorlevel%"

echo.
if not "%RC%"=="0" (
  echo ============================================================
  echo   PUSH FAILED
  echo ============================================================
  echo.
  echo   If it asks for a username and password:
  echo     Username: oldrice1983-droid
  echo     Password: paste a Personal Access Token
  echo       Get one: https://github.com/settings/tokens
  echo         - Generate new token (classic)
  echo         - Note: anything
  echo         - Tick the "repo" box
  echo         - Generate, copy the ghp_... string
  echo.
  echo   If it says "repository not found":
  echo     Check the repo is Public and named exactly pindu-star
  echo ============================================================
  echo.
) else (
  echo ============================================================
  echo   PUSH OK
  echo ============================================================
  echo.
  echo   NEXT STEPS:
  echo     1. Open: https://github.com/oldrice1983-droid/pindu-star/actions
  echo     2. Pick the workflow on the left
  echo     3. Click "Run workflow" on the right, wait 5-10 min
  echo     4. At the bottom of the run page download "pindu-star-ipa"
  echo     5. Unzip it to get the .ipa file
  echo     6. Install to iPhone using Sideloadly
  echo ============================================================
  echo.
)

echo.
pause
