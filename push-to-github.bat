@echo off
cd /d "%~dp0"
echo ============================================================
echo   Pindu Star - Push to GitHub and build IPA
echo ============================================================
echo.
echo   [STEP 1] Create an EMPTY repo first:
echo      1. Open: https://github.com/new
echo      2. Repository name: pindu-star
echo      3. Visibility: Public   (MUST be Public)
echo      4. Do NOT check README / .gitignore / license
echo      5. Click "Create repository"
echo.
echo   [STEP 2] Press any key to push now...
pause >nul

echo.
echo Pushing to origin...
git push -u origin main

echo.
if %errorlevel% neq 0 (
  echo ============================================================
  echo   PUSH FAILED
  echo.
  echo   Common causes:
  echo     1. Repo not created yet -> go to https://github.com/new
  echo        Name: pindu-star, Visibility: Public, NO extra files
  echo     2. Wrong username or token
  echo     3. Network problem
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
  echo     4. At the bottom, download artifact "pindu-star-ipa"
  echo     5. Unzip it, you will get the .ipa file
  echo     6. Install to iPhone with Sideloadly
  echo ============================================================
  echo.
)

echo.
pause
