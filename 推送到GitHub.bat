@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   拼读星球 - 推送到 GitHub（触发云端编译 IPA）
echo ============================================================
echo.
echo   本地仓库已初始化完成，远程地址：
echo   https://github.com/oldrice1983-droid/pindu-star.git
echo.
echo   [必做前置] 先在浏览器新建一个「空」仓库，否则推送会失败：
echo     1. 打开 https://github.com/new
echo     2. Repository name 填：pindu-star
echo     3. Public 选 Public（必须，否则无法免费云编译）
echo     4. 不要勾 README / .gitignore / license
echo     5. 点 Create repository
echo.
echo   准备好后按任意键继续...
pause >nul

echo.
echo 正在推送...
git push -u origin main

echo.
if %errorlevel% neq 0 (
  echo ============================================================
  echo   [推送失败]
  echo.
  echo   常见原因：
  echo     1. 仓库还没创建 —— 请先按刚才提示去 https://github.com/new 建
  echo     2. 用户名或 token 填错
  echo     3. 网络问题
  echo ============================================================
  echo.
) else (
  echo ============================================================
  echo   推送成功！
  echo.
  echo   下一步：
  echo     1. 打开 https://github.com/oldrice1983-droid/pindu-star/actions
  echo     2. 左侧选「构建 IPA（云端，无需 Mac）」
  echo     3. 右侧点 Run workflow，等 5-10 分钟
  echo     4. 页面底部 Artifacts 点 pindu-star-ipa 下载
  echo     5. 解压得到 拼读星球-unsigned.ipa
  echo     6. 用 Sideloadly 装到 iPhone（见 免费侧载安装教程.md）
  echo ============================================================
  echo.
)

echo.
pause
