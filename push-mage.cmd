@echo off
REM Re-open with cmd /k so the window NEVER auto-closes.
if /I not "%MAGE_KEEP%"=="1" (
  set MAGE_KEEP=1
  cmd /k "%~f0" %*
  exit /b
)

cd /d "%~dp0"
chcp 65001 >nul
setlocal EnableExtensions

echo ========================================
echo  push-mage  (window stays open)
echo  project: %CD%
echo ========================================
echo.

set SRC=%~1
if "%SRC%"=="" (
  echo Drag the character folder onto push-mage.cmd
  echo Example: D:\ai炼丹\香草社\人物生成图\法师1新
  echo.
  echo Or create mage-src.txt with one path line, then run again.
  if exist "mage-src.txt" (
    set /p SRC=<mage-src.txt
  )
)

if "%SRC%"=="" (
  echo FAIL: no source folder argument.
  goto END
)

set SRC=%SRC:"=%
echo Source: %SRC%
echo.

if not exist "%SRC%\" (
  echo FAIL: folder not found.
  goto END
)

REM ---- 投放门禁：W3 必过。真透明 PNG 不达标就不许投放 ----
set GATEPY=
if defined XIANGCAO_TOOLKIT (
  if exist "%XIANGCAO_TOOLKIT%\comfyui\python_embeded\python.exe" set GATEPY=%XIANGCAO_TOOLKIT%\comfyui\python_embeded\python.exe
)
if not defined GATEPY if exist "F:\BaiduNetdisk\minimax\MiniMaxH3\ben-M3-V03\ben-M3-V03\comfyui\python_embeded\python.exe" (
  set GATEPY=F:\BaiduNetdisk\minimax\MiniMaxH3\ben-M3-V03\ben-M3-V03\comfyui\python_embeded\python.exe
)
if not defined GATEPY (
  where python >nul 2>nul && set GATEPY=python
)
if not defined GATEPY (
  echo FAIL: 找不到 python，无法跑投放门禁。
  goto END
)

echo ---- 投放门禁：透明底检查 ----
"%GATEPY%" "scripts\check-sprite-alpha.py" "%SRC%" --quiet
if errorlevel 1 (
  echo.
  echo FAIL: 透明底验收未过（W3 没跑好）—— 已阻止投放。
  echo 回动作循环页面重跑 W3 BiRefNet，再导出一次。
  echo 糊进角色轮廓的脏边，在游戏里补抠救不回来。
  goto END
)
echo OK: 透明底验收通过
echo.

set DST=public\sprites\inbox\base_animations
mkdir "%DST%\walking" 2>nul
mkdir "%DST%\attack" 2>nul
mkdir "%DST%\death" 2>nul
mkdir "%DST%\idle" 2>nul

set COPIED=0

if exist "%SRC%\走路\" (
  echo Copy 走路 -^> walking
  xcopy /Y /Q "%SRC%\走路\*.png" "%DST%\walking\"
  set COPIED=1
)
if exist "%SRC%\walking\" (
  echo Copy walking
  xcopy /Y /Q "%SRC%\walking\*.png" "%DST%\walking\"
  set COPIED=1
)
if exist "%SRC%\攻击\" (
  echo Copy 攻击 -^> attack
  xcopy /Y /Q "%SRC%\攻击\*.png" "%DST%\attack\"
)
if exist "%SRC%\attack\" xcopy /Y /Q "%SRC%\attack\*.png" "%DST%\attack\"
if exist "%SRC%\死亡\" (
  echo Copy 死亡 -^> death
  xcopy /Y /Q "%SRC%\死亡\*.png" "%DST%\death\"
)
if exist "%SRC%\death\" xcopy /Y /Q "%SRC%\death\*.png" "%DST%\death\"
if exist "%SRC%\待机\" (
  echo Copy 待机 -^> idle
  xcopy /Y /Q "%SRC%\待机\*.png" "%DST%\idle\"
)
if exist "%SRC%\idle\" xcopy /Y /Q "%SRC%\idle\*.png" "%DST%\idle\"

echo.
echo walking files now:
dir /b "%DST%\walking\*.png" 2>nul
echo.

dir /b "%DST%\walking\*.png" >nul 2>nul
if errorlevel 1 (
  echo FAIL: no png in walking. Check source subfolders:
  dir /b "%SRC%"
  goto END
)

where git >nul 2>nul
if errorlevel 1 (
  echo FAIL: git not in PATH
  goto END
)

git add -- "public/sprites/inbox/base_animations"
echo --- git status ---
git status --porcelain -- "public/sprites/inbox/base_animations"

git diff --cached --quiet -- "public/sprites/inbox/base_animations"
if not errorlevel 1 (
  echo FAIL: nothing new to commit
  goto END
)

git commit -m "Update female mage base animations from studio pack."
if errorlevel 1 (
  echo FAIL: git commit
  goto END
)

git push
if errorlevel 1 (
  echo FAIL: git push
  goto END
)

echo.
echo OK. Tell agent: 图放好了

:END
echo.
echo -------- finished / stopped --------
echo This window will stay open. Close it manually when done.
echo.
