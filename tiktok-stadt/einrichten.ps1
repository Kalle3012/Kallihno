# TikTok-Stadt: richtet alles auf deinem Windows-PC ein.
#
# So startest du es: Windows-Taste druecken, "PowerShell" tippen, oeffnen und diese Zeile einfuegen:
#   irm https://raw.githubusercontent.com/Kalle3012/Kallihno/claude/busy-volta-ppw57f/tiktok-stadt/einrichten.ps1 | iex
#
# Was passiert:
#   1. Node.js wird installiert, falls es fehlt
#   2. Das Programm wird nach "Desktop\TikTok-Stadt" geladen (eine vorhandene Stadt und Einstellungen bleiben erhalten)
#   3. Die Bausteine werden installiert (npm install)
#   4. Dein TikTok-Name wird in einstellungen.json gespeichert
#   5. Auf dem Desktop entstehen "TikTok-Stadt starten" und "Stadt-Regie"
# Du kannst das Skript jederzeit erneut ausfuehren, um auf die neueste Version zu aktualisieren.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Schritt($text) { Write-Host ''; Write-Host "==> $text" -ForegroundColor Cyan }

try {
  $desktop = [Environment]::GetFolderPath('Desktop')
  $ziel = Join-Path $desktop 'TikTok-Stadt'

  # ------------------------------------------------------------------ 1. Node.js
  Schritt '1/5  Node.js pruefen'
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
      Write-Host 'Node.js fehlt und wird jetzt installiert. Windows fragt eventuell nach Erlaubnis: bitte mit "Ja" bestaetigen.'
      winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
      $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
      Write-Host ''
      Write-Host 'Node.js konnte nicht automatisch installiert werden.' -ForegroundColor Yellow
      Write-Host 'Bitte auf der Seite, die sich jetzt oeffnet, die LTS-Version installieren, dieses Fenster schliessen' -ForegroundColor Yellow
      Write-Host 'und das Skript in einem NEUEN PowerShell-Fenster noch einmal starten.' -ForegroundColor Yellow
      Start-Process 'https://nodejs.org'
      return
    }
  }
  Write-Host ('Node.js ' + (node -v) + ' ist installiert.')

  # ------------------------------------------------------------------ 2. Programm laden
  Schritt '2/5  Programm herunterladen'
  $zip = Join-Path $env:TEMP 'tiktok-stadt.zip'
  $entpackt = Join-Path $env:TEMP 'tiktok-stadt-download'
  Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/Kalle3012/Kallihno/archive/refs/heads/claude/busy-volta-ppw57f.zip' -OutFile $zip
  if (Test-Path $entpackt) { Remove-Item $entpackt -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $entpackt -Force
  $oberordner = Get-ChildItem $entpackt -Directory | Select-Object -First 1
  $quelle = Join-Path $oberordner.FullName 'tiktok-stadt'
  if (-not (Test-Path (Join-Path $quelle 'server.js'))) { throw 'Im Download fehlt der Ordner tiktok-stadt.' }
  New-Item -ItemType Directory -Force -Path $ziel | Out-Null
  # Neue Programmdateien drueberkopieren. Der Ordner "data" (deine Stadt) und "einstellungen.json" bleiben erhalten.
  & robocopy.exe $quelle $ziel /E /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Kopieren nach $ziel ist fehlgeschlagen (robocopy Code $LASTEXITCODE)." }
  Get-ChildItem $ziel -Recurse -File | Unblock-File -ErrorAction SilentlyContinue
  Remove-Item $zip -Force -ErrorAction SilentlyContinue
  Remove-Item $entpackt -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "Gespeichert in: $ziel"

  # ------------------------------------------------------------------ 3. Bausteine
  Schritt '3/5  Bausteine installieren (dauert ca. 1 Minute)'
  Push-Location $ziel
  try {
    & npm.cmd install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm install ist fehlgeschlagen. Ist der PC mit dem Internet verbunden?' }
  } finally { Pop-Location }

  # ------------------------------------------------------------------ 4. Einstellungen
  Schritt '4/5  Einstellungen'
  $datei = Join-Path $ziel 'einstellungen.json'
  if (Test-Path $datei) {
    $e = Get-Content $datei -Raw -Encoding UTF8 | ConvertFrom-Json
    Write-Host 'Vorhandene Einstellungen werden behalten.'
  } else {
    $e = Get-Content (Join-Path $ziel 'einstellungen.beispiel.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  }
  if ($e.tiktokName) { Write-Host ('Gespeicherter TikTok-Name: ' + $e.tiktokName) }
  $name = Read-Host 'Dein TikTok-Name ohne @ (einfach Enter druecken, um den gespeicherten zu behalten)'
  if ($name) { $e.tiktokName = $name.Trim().TrimStart('@') }
  [IO.File]::WriteAllText($datei, ($e | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
  Write-Host 'Einstellungen gespeichert.'

  # ------------------------------------------------------------------ 5. Verknuepfungen
  Schritt '5/5  Verknuepfungen auf dem Desktop anlegen'
  $shell = New-Object -ComObject WScript.Shell
  $start = $shell.CreateShortcut((Join-Path $desktop 'TikTok-Stadt starten.lnk'))
  $start.TargetPath = Join-Path $ziel 'START-WINDOWS.bat'
  $start.WorkingDirectory = $ziel
  $start.Save()
  $edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($edge) {
    $regie = $shell.CreateShortcut((Join-Path $desktop 'Stadt-Regie (Edge).lnk'))
    $regie.TargetPath = $edge
    $regie.Arguments = 'http://localhost:3000/regie.html'
    $regie.Save()
  } else {
    Set-Content -Path (Join-Path $desktop 'Stadt-Regie.url') -Value "[InternetShortcut]`r`nURL=http://localhost:3000/regie.html"
  }

  Write-Host ''
  Write-Host '======================================================' -ForegroundColor Green
  Write-Host ' Fertig! Auf deinem Desktop liegen jetzt:' -ForegroundColor Green
  Write-Host '   - "TikTok-Stadt starten"  (das Programm)' -ForegroundColor Green
  Write-Host '   - "Stadt-Regie"           (Stimme + Knoepfe)' -ForegroundColor Green
  Write-Host ''
  Write-Host ' Zum Ausprobieren: "TikTok-Stadt starten" doppelklicken -> 2 waehlen.' -ForegroundColor Green
  Write-Host ' Im echten Live:   "TikTok-Stadt starten" -> 3 und ja (erster Live) bzw. 1 (ab dem zweiten Live).' -ForegroundColor Green
  Write-Host '======================================================' -ForegroundColor Green
} catch {
  Write-Host ''
  Write-Host ('FEHLER: ' + $_.Exception.Message) -ForegroundColor Red
  Write-Host 'Mach bitte einen Screenshot von diesem Fenster und schick ihn mir.' -ForegroundColor Red
}
