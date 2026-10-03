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
if not defined GIT if exist "C:/Program Files/Git/cmd/git.exe" set "GIT=C:/Program Files\Git\cmd\git.exe"
if not defined GIT if exist "C:/Program Files/Git/bin/git.exe" set "GIT=C:/Program Files\Git\bin\git.exe"
if not defined GIT if exist "C:/Program Files (x86)/Git/cmd/git.exe" set "GIT=C:/Program Files (x86)\Git\cmd\git.exe"
if not defined GIT if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" set "GIT=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
if not defined GIT if exist "%USERPROFILE%\.workbuddy\binaries\PortableGit\versions\1.2.0\mingw64\bin\git.exe" set "GIT=%USERPROFILE%\.workbuddy\binaries\PortableGit\versions\1.2.0\mingw64\bin\git.exe"
if not defined GIT for /d %%A in ("%USERPROFILE%\.workbuddy\binaries\PortableGit\*") do if not defined GIT for /d %%B in ("%%~fA\*") do if exist "%%~fB\mingw64\bin\git.exe" set "GIT=%%~fB\mingw64\bin\git.exe"

if not defined GIT (
  echo   ERROR: git.exe not found.
  echo.
  echo   Install Git for Windows from https://git-scm.com/download/win
  echo   Then open a NEW command window and run this again.
  echo.
  pause
  exit /b 1
)

echo   git OK
echo   !GIT!
echo.
echo   Press any key to start the upload...
pause >nul

echo.
echo Uploading about 20 MB. This may take a few minutes.
echo.
echo If it asks for a username and password:
echo   Username   oldrice1983-droid
echo   Password   paste a token, NOT your login password
echo   Get a token:  https://github.com/settings/tokens
echo                Generate new token (classic)
echo                Note: anything
echo                Tick the box named  repo
echo                Generate, copy the ghp_... text
echo.
"!GIT!" push -u origin main
set "RC=%errorlevel%"

echo.
if not "%RC%"=="0" (
  echo ============================================================
  echo   PUSH FAILED - exit code %RC%
  echo ============================================================
  echo.
  echo   Read the message just above - it names the cause:
  echo.
  echo   repository not found  /  could not read from remote
  echo     -> the repo must be Public and named exactly pindu-star
  echo        Check: https://github.com/oldrice1983-droid/pindu-star
  echo        Use Settings to change Visibility to Public.
  echo.
  echo   Authentication failed  /  403
  echo     -> wrong token. Make a new one with the repo box ticked.
  echo.
  echo   failed to push some refs
  echo     -> remote already has commits. Run FORCE-push.bat instead.
  echo.
  echo   SSL  /  timeout  /  unable to access
  echo     -> network problem, try again later
  echo ============================================================
  echo.
) else (
  echo ============================================================
  echo   PUSH OK - uploaded
  echo ============================================================
  echo.
  echo   NEXT STEPS:
  echo     1. Open  https://github.com/oldrice1983-droid/pindu-star/actions
  echo     2. Click the workflow on the left
  echo     3. Click  Run workflow  on the right
  echo     4. Wait 5 to 10 minutes
  echo     5. At the bottom of the run page download  pindu-star-ipa
  echo     6. Unzip it to get the .ipa file
  echo     7. Install to iPhone with Sideloadly
  echo ============================================================
  echo.
)

echo.
pause
