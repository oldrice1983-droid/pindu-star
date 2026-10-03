@echo off
chcp 65001 >nul
echo ============================================================
echo   拼读星球 - 推送到 GitHub（触发云端编译 IPA）
echo ============================================================
echo.

set /p USER=请输入你的 GitHub 用户名（例如 zhangsan）:

if "%USER%"=="" (
  echo [错误] 用户名不能为空
  pause
  exit /b 1
)

echo.
echo 正在设置远程仓库地址...
cd /d "%~dp0"
git remote remove origin 2>nul
git remote add origin https://github.com/%USER%/pindu-star.git

echo.
echo ============================================================
echo   接下来会提示输入 GitHub 用户名和密码
echo.
echo   [重要] 密码位置请粘贴「Personal access token」
echo   获取方式：https://github.com/settings/tokens
echo     - Note: 勾选 repo
echo     - Expiration: 选 30 days 或 90 days
echo     - 生成后复制那串 ghp_...，粘贴到密码处
echo
echo   用户名处填：%USER%
echo   密码处填  ：你的 token（不是登录密码）
echo ============================================================
echo.

git push -u origin main

echo.
if %errorlevel% neq 0 (
  echo [推送失败] 常见原因：
  echo   1. 仓库 %USER%/pindu-star 还没在 GitHub 上创建
  echo      → 先去 https://github.com/new 创建，勾选 Public
  echo   2. 用户名或 token 填错
  echo   3. 网络问题
) else (
  echo ============================================================
  echo   推送成功！
  echo.
  echo   下一步：
  echo   1. 打开 https://github.com/%USER%/pindu-star/actions
  echo   2. 左侧选「构建 IPA（云端，无需 Mac）」
  echo   3. 点右侧 Run workflow，等 5-10 分钟
  echo   4. 页面底部 Artifacts 点 pindu-star-ipa 下载
  echo   5. 解压得到 拼读星球-unsigned.ipa
  echo   6. 用 Sideloadly 装到 iPhone（见 免费侧载安装教程.md）
  echo ============================================================
)

echo.
pause
