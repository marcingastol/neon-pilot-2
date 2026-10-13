@echo off
setlocal
cd /d "%~dp0"

echo ================================================
echo Publikowanie folderu neon-pilot na GitHubie
echo ================================================
echo.

where git >nul 2>nul
if errorlevel 1 (
    echo BLAD: Git nie jest zainstalowany albo nie ma go w PATH.
    echo Zainstaluj Git for Windows z https://git-scm.com/download/win
    echo i uruchom ten skrypt ponownie.
    pause
    exit /b 1
)

if not exist ".git" (
    echo Inicjalizuje osobne repozytorium tylko w tym folderze...
    git init -b main
    if errorlevel 1 goto :error
)

git branch -M main
if errorlevel 1 goto :error

set "REPO_URL=https://github.com/marcingastol/neon-pilot.git"
set "CURRENT_ORIGIN="
for /f "delims=" %%U in ('git remote get-url origin 2^>nul') do set "CURRENT_ORIGIN=%%U"
if not defined CURRENT_ORIGIN (
    git remote add origin "%REPO_URL%"
    if errorlevel 1 goto :error
) else if /I not "%CURRENT_ORIGIN%"=="%REPO_URL%" (
    echo BLAD: Skonfigurowany adres origin jest inny:
    echo   %CURRENT_ORIGIN%
    echo Oczekiwany adres:
    echo   %REPO_URL%
    echo Skrypt niczego nie wyslal. Sprawdz konfiguracje repozytorium.
    pause
    exit /b 1
)

echo.
echo Dodaje pliki z tego folderu. Ustawienia .gitignore sa respektowane.
git add -A
if errorlevel 1 goto :error

echo.
echo Pliki przygotowane do wyslania:
git status --short
echo.
echo Folder data jest ignorowany przez .gitignore.
echo Sprawdz powyzsza liste przed kontynuowaniem.
choice /C TN /N /M "Wyslac te zmiany na GitHub? T=tak, N=anuluj: "
if errorlevel 2 (
    echo Anulowano. Zmiany pozostaly przygotowane lokalnie w Git.
    pause
    exit /b 0
)

rem Commituj tylko wtedy, gdy sa nowe zmiany do zapisania.
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "Publikacja neon-pilot"
    if errorlevel 1 goto :error
) else (
    echo Brak nowych zmian do commitowania; sprobuje wyslac istniejacy branch.
)

echo.
echo Wysylam branch main do %REPO_URL% ...
git push -u origin main
if errorlevel 1 (
    echo.
    echo Wysylanie nie powiodlo sie. Jesli GitHub poprosi o logowanie,
    echo zakoncz autoryzacje w przegladarce i uruchom ten skrypt ponownie.
    echo Jesli repozytorium na GitHubie zawiera juz pliki, np. README,
    echo push moze wymagac najpierw uzgodnienia historii.
    pause
    exit /b 1
)

echo.
echo Gotowe! Repozytorium: https://github.com/marcingastol/neon-pilot
pause
exit /b 0

:error
echo.
echo Wystapil blad. Nic wiecej nie zostalo wyslane.
echo Sprawdz komunikaty powyzej oraz konfiguracje Git.
pause
exit /b 1
