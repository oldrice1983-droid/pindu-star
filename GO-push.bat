@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================================
echo   Pindu Star - push to GitHub, build IPA
echo ============================================================
echo.

rem ---------- find git.exe ----------
set "GIT="
where git >nul 2>&1 && set "GIT=git"
if not defined GIT if exist "C:\Program Files\Git\cmd\git.exe" set "GIT=C:\Program Files\Git\cmd\git.exe"
if not defined GIT if exist "C:\Program Files\Git\bin\git.exe" set "GIT=C:\Program Files\Git\bin\git.exe"
if not defined GIT if exist "C:\Program Files (x86)\Git\cmd\git.exe" set "GIT=C:\Program Files (x86)\Git\cmd\git.exe"
if not defined GIT if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" set "GIT=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
if not defined GIT if exist "%USERPROFILE%\.workbuddy\binaries\PortableGit\versions\1.2.0\mingw64\bin\git.exe" set "GIT=%USERPROFILE%\.workbuddy\binaries\PortableGit\versions\1.2.0\mingw64\bin\git.exe"
if not defined GIT for /d %%A in ("%USERPROFILE%\.workbuddy\binaries\PortableGit\*") do if not defined GIT for /d %%B in ("%%~fA\*") do if exist "%%~fB\mingw64\bin\git.exe" set "GIT=%%~fB\mingw64\bin\git.exe"

if not defined GIT (
  echo   ERROR: git.exe not found.
  echo.
  echo   Install Git for Windows from:
  echo     https://git-scm.com/download/win
  echo   Then open a NEW command window and run this again.
  echo.
  pause
  exit /b 1
)

echo   git OK
echo   !GIT!
echo.

echo   Checking the remote repo...
"!GIT!" ls-remote --exit-code origin HEAD >nul 2>&1
if errorlevel 1 (
  echo.
  echo  ============================================================
  echo   STOP - the GitHub repo does not exist yet.
  echo  ============================================================
  echo.
  echo   Do this first, in your browser:
  echo.
  echo     1. Open   https://github.com/new
  echo     2. Repository name   pindu-star
  echo     3. Visibility   Public      ^<-- MUST be Public
  echo     4. Do NOT tick README or .gitignore or license
  echo     5. Click the green Create repository button
  echo.
  echo   Then run this file again.
  echo.
  pause
  exit /b 1
)
echo   Repo OK - ready to push.
echo.
echo   Press any key to start the upload...
pause >nul

echo.
echo Uploading (about 20 MB, may take a few minutes)...
"!GIT!" push -u origin main
set "RC=%errorlevel%"

echo.
if not "%RC%"=="0" (
  echo ============================================================
  echo   PUSH FAILED
  echo ============================================================
  echo.
  echo   If it asks for username / password:
  echo     Username   oldrice1983-droid
  echo     Password   paste a token, not your login password
  echo     Get a token:  https://github.com/settings/tokens
  echo                  Generate new token (classic)
  echo                  Note: anything
  echo                  Tick the box named  repo
  echo                  Generate, then copy the ghp_... text
  echo.
  echo   If it says repository not found:
  echo     The repo must be Public and named exactly  pindu-star
  echo ============================================================
  echo.
) else (
  echo ============================================================
  echo   PUSH OK
  echo ============================================================
  echo.
  echo   NEXT:
  echo     1. Open  https://github.com/oldrice1983-droid/pindu-star/actions
  echo     2. Click the workflow on the left
  echo     3. Click  Run workflow  on the right, wait 5-10 min
  echo     4. At the bottom of the run page download  pindu-star-ipa
  echo     5. Unzip it to get the .ipa file
  echo     6. Install to iPhone with Sideloadly
  echo ============================================================
  echo.
)

echo.
pause
