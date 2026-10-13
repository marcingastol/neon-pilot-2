@echo off
setlocal
chcp 65001 >nul
set PYTHONUTF8=1
pushd "%~dp0"
if errorlevel 1 goto path_error
if not exist ".venv\Scripts\python.exe" goto install_first
".venv\Scripts\python.exe" run.py %*
set RESULT=%ERRORLEVEL%
popd
if not "%RESULT%"=="0" pause
exit /b %RESULT%
:install_first
echo Najpierw uruchom INSTALUJ.cmd. Instrukcja jest w README.md.
popd
pause
exit /b 1
:path_error
echo Nie mozna otworzyc folderu aplikacji. Rozpakuj ZIP do folderu lokalnego.
pause
exit /b 1
