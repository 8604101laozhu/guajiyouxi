@echo off
REM Sprite alpha gate. ASCII only before chcp, or cmd misparses UTF-8 under GBK.
if /I not "%ALPHA_KEEP%"=="1" (
  set ALPHA_KEEP=1
  cmd /k "%~f0" %*
  exit /b
)

cd /d "%~dp0"
chcp 65001 >nul
setlocal EnableExtensions

echo ========================================
echo  投放门禁  check-sprite-alpha
echo  project: %CD%
echo ========================================
echo.

REM ---- find a python with PIL/numpy/scipy ----
set PY=
if defined XIANGCAO_TOOLKIT (
  if exist "%XIANGCAO_TOOLKIT%\comfyui\python_embeded\python.exe" set PY=%XIANGCAO_TOOLKIT%\comfyui\python_embeded\python.exe
)
if not defined PY if exist "F:\BaiduNetdisk\minimax\MiniMaxH3\ben-M3-V03\ben-M3-V03\comfyui\python_embeded\python.exe" (
  set PY=F:\BaiduNetdisk\minimax\MiniMaxH3\ben-M3-V03\ben-M3-V03\comfyui\python_embeded\python.exe
)
if not defined PY (
  where python >nul 2>nul && set PY=python
)
if not defined PY (
  echo FAIL: 找不到 python。装一个，或设 XIANGCAO_TOOLKIT 指向工具箱根目录。
  set RC=2
  goto END
)

REM ---- target folder: drag onto this script, or read alpha-src.txt ----
set SRC=%~1
if "%SRC%"=="" (
  if exist "alpha-src.txt" set /p SRC=<alpha-src.txt
)
if "%SRC%"=="" (
  echo 用法：把角色文件夹拖到 check-alpha.cmd 上。
  echo 例：D:\ai炼丹\香草社\人物生成图\法师1新
  echo.
  echo 或者把路径写进 alpha-src.txt（一行），再双击一次。
  echo.
  echo 也可以直接检查已投放的目录，例如：
  echo   check-alpha.cmd public\sprites\inbox\characters\nv-fashi
  set RC=2
  goto END
)

set SRC=%SRC:"=%
echo 检查目录: %SRC%
echo.

"%PY%" "scripts\check-sprite-alpha.py" "%SRC%"
set RC=%ERRORLEVEL%

echo.
if "%RC%"=="0" (
  echo ========================================
  echo  结果：PASS —— 可以进游戏
  echo ========================================
) else if "%RC%"=="1" (
  echo ========================================
  echo  结果：FAIL —— 不要投放
  echo  回动作循环页面重跑 W3 BiRefNet，再导出一次。
  echo ========================================
) else (
  echo ========================================
  echo  结果：无法检查（用法或环境问题，见上）
  echo ========================================
)

:END
echo.
echo -------- finished / stopped --------
echo 窗口不会自动关，看完手动关。

REM Return the gate's verdict so callers can chain on it.
REM 把门禁结论作为退出码传出去，脚本串联时才拦得住。
exit /b %RC%
