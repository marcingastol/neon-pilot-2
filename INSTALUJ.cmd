@echo off
setlocal
chcp 65001 >nul
set PYTHONUTF8=1
pushd "%~dp0"
if errorlevel 1 goto path_error
where py >nul 2>nul
if errorlevel 1 goto use_python
py -3 -c "import sys" >nul 2>nul
if errorlevel 1 goto use_python
py -3 setup_windows.py
goto finish
:use_python
where python >nul 2>nul
if errorlevel 1 goto no_python
python setup_windows.py
goto finish
:no_python
echo Nie znaleziono Pythona. Sprawdz polecenie py --version lub python --version.
echo Uruchom instalator Pythona i wlacz opcje dodania Pythona do PATH.
popd
pause
exit /b 1
:path_error
echo Nie mozna otworzyc folderu aplikacji. Rozpakuj ZIP do folderu lokalnego.
pause
exit /b 1
:finish
set RESULT=%ERRORLEVEL%
popd
echo.
pause
exit /b %RESULT%
