@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================================
echo   Pindu Star - Push to GitHub and build IPA
echo ============================================================
echo.

rem ---- locate git.exe (may not be on PATH in cmd) ----
set "GIT="
where git >nul 2>&1 && set "GIT=git"
if not defined GIT if exist "C:\Program Files\Git\cmd\git.exe" set "GIT=C:\Program Files\Git\cmd\git.exe"
if not defined GIT if exist "C:\Program Files (x86)\Git\cmd\git.exe" set "GIT=C:\Program Files (x86)\Git\cmd\git.exe"
if not defined GIT if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" set "GIT=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
if not defined GIT (
  for /f "delims=" %%i in ('dir /b /s "%USERPROFILE%\.workbuddy\binaries\PortableGit\*\mingw64\bin\git.exe" 2^>nul') do (
    if not defined GIT set "GIT=%%i"
  )
)
if not defined GIT (
  for /f "delims=" %%i in ('dir /b /s "%USERPROFILE%\.workbuddy\binaries\PortableGit\*\cmd\git.exe" 2^>nul') do (
    if not defined GIT set "GIT=%%i"
  )
)
if not defined GIT if exist "C:\Program Files\Git\bin\git.exe" set "GIT=C:\Program Files\Git\bin\git.exe"
if not defined GIT (
  echo   ERROR: git.exe not found on this computer.
  echo.
  echo   Fix: install Git for Windows from https://git-scm.com/download/win
  echo   Then run this file again.
  echo.
  pause
  exit /b 1
)
echo   git found: !GIT!
echo.

echo   Checking remote...
"!GIT!" ls-remote --exit-code origin HEAD >nul 2>&1
if errorlevel 1 (
  echo.
  echo   [STOP] The repo does not exist yet, so push cannot work.
  echo.
  echo   Do this FIRST, in your browser:
  echo     1. Open:  https://github.com/new
  echo     2. Repository name:  pindu-star
  echo     3. Visibility:  Public   ^<-- MUST be Public
  echo     4. Leave README / .gitignore / license UNCHECKED
  echo     5. Click the green "Create repository" button
  echo.
  echo   Then come back and run this file again.
  echo.
  pause
  exit /b 1
)
echo   Remote repo confirmed reachable.
echo.

echo   [STEP 1] Press any key to push now...
pause >nul

echo.
echo Pushing to origin...
"!GIT!" push -u origin main
set "RC=%errorlevel%"

echo.
if not "%RC%"=="0" (
  echo ============================================================
  echo   PUSH FAILED (exit code %RC%)
  echo.
  echo   If the message is "repository not found" or 403:
  echo     - You have NOT created the repo yet
  echo     - Go to https://github.com/new  ->  name: pindu-star
  echo     - Visibility: Public     ->  Create repository
  echo     - Then run this file again
  echo.
  echo   If it asks for a password:
  echo     - Username: oldrice1983-droid
  echo     - Password: paste a Personal Access Token
  echo       (get one at https://github.com/settings/tokens
  echo        - Generate new token (classic)
  echo        - Note: anything
  echo        - Check the "repo" box
  echo        - Generate, then copy the ghp_... string)
  echo ============================================================
  echo.
) else (
  echo ============================================================
  echo   PUSH OK
  echo.
  echo   NEXT STEPS:
  echo     1. Open: https://github.com/oldrice1983-droid/pindu-star/actions
  echo     2. Click the workflow on the left
  echo     3. Click "Run workflow" on the right, wait 5-10 min
  echo     4. At the bottom of the run page, download the artifact
  echo        named "pindu-star-ipa"
  echo     5. Unzip it - you get the .ipa file
  echo     6. Install to iPhone with Sideloadly
  echo ============================================================
  echo.
)

echo.
pause
