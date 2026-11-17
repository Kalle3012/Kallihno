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
echo  1 = Echter Live (die Stadt von letztem Mal geht weiter)
echo  2 = Probelauf mit erfundenen Zuschauern
echo  3 = Echter Live mit NEUER, leerer Stadt
set /p wahl=Auswahl (1/2/3): 
if "%wahl%"=="3" (
  echo.
  echo ACHTUNG: Die jetzige Stadt wird geleert. Eine Sicherung kommt in den Ordner data\sicherungen.
  set /p sicher=Wirklich neu anfangen? Dann ja eintippen: 
)
if "%wahl%"=="3" if /i not "%sicher%"=="ja" (
  echo Abgebrochen. Starte mit der bisherigen Stadt.
  set wahl=1
)
if "%wahl%"=="2" (
  node server.js --demo --neu --oeffnen
  pause
  exit /b
)
set name=
echo.
echo Dein TikTok-Name ohne @ (einfach Enter druecken, wenn er in einstellungen.json steht)
set /p name=Name: 
if "%wahl%"=="3" (
  node server.js %name% --neu --oeffnen
) else (
  node server.js %name% --oeffnen
)
pause
