@echo off
chcp 65001 >nul
cd /d "%~dp0"
title TikTok-Stadt
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js fehlt. Bitte installieren: https://nodejs.org  ^(LTS-Version^), danach diese Datei erneut starten.
  echo.
  pause
  exit /b
)
if not exist node_modules\@anthropic-ai (
  echo Installation, dauert ca. 1 Minute ...
  call npm install
)
if not exist einstellungen.json copy einstellungen.beispiel.json einstellungen.json >nul
echo.
echo  1 = Echter Live
echo  2 = Probelauf mit erfundenen Zuschauern
echo  3 = Echter Live, Stadt vorher leeren
set /p wahl=Auswahl (1/2/3): 
if "%wahl%"=="2" (
  start "" http://localhost:3000
  start "" http://localhost:3000/regie.html
  node server.js --demo --neu
  pause
  exit /b
)
set /p name=Dein TikTok-Name (ohne @): 
start "" http://localhost:3000
start "" http://localhost:3000/regie.html
if "%wahl%"=="3" (
  node server.js %name% --neu
) else (
  node server.js %name%
)
pause
