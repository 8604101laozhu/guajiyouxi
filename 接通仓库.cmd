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
)
git branch -M main
git config user.name "guajiyouxi"
git config user.email "guajiyouxi@local"

echo.
echo 把仓库地址贴进来后回车
echo 例如 https://github.com/8604101laozhu/guajiyouxi.git
echo.
set /p URL=仓库地址:
if "%URL%"=="" (
  echo 没有地址，取消。
  pause
  exit /b 1
)

git remote remove origin 2>nul
git remote add origin %URL%
git add -A
if exist "新建 文本文档.txt" git reset -- "新建 文本文档.txt" 2>nul
git commit -m "Add project and sprite frames from this PC."
git push -u origin main
if errorlevel 1 (
  echo.
  echo 若失败，在这个文件夹打开终端，执行：
  echo git remote set-url origin https://github.com/8604101laozhu/guajiyouxi.git
  echo git push -u origin main
) else (
  echo.
  echo 通了。以后丢图进 drop，再跟我说「图放好了」。不要把 png 拖进对话。
)
pause
