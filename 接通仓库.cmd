@echo off
chcp 65001 >nul
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo 还没装 Git。打开 https://git-scm.com/download/win 装好再运行这个。
  pause
  exit /b 1
)

if not exist .git (
  git init
  git branch -M main
)

git config user.name "guajiyouxi"
git config user.email "guajiyouxi@local"

echo.
echo GitHub 的办法：图只进仓库，不进聊天。
echo 把仓库地址贴进来后回车
echo.

set /p URL=仓库地址:
if "%URL%"=="" (
  echo 没有地址，取消。
  pause
  exit /b 1
)

git remote remove origin 2>nul
git remote add origin %URL%
git add -- public/sprites/inbox README.md .gitignore .gitattributes
git status --short
git commit -m "Add sprite frames from this PC." 2>nul
git push -u origin main
if errorlevel 1 (
  echo.
  echo 推送失败。用 GitHub Desktop 打开这个文件夹，点 Publish / Push。
) else (
  echo.
  echo 通了。以后丢图进 drop，再跟我说「图放好了」。不要把 png 拖进对话。
)
pause