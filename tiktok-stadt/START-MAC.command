#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null; then
  echo "Node.js fehlt. Bitte installieren: https://nodejs.org (LTS-Version), danach erneut starten."
  read -r; exit 1
fi
[ -d node_modules/@anthropic-ai ] || { echo "Installation, dauert ca. 1 Minute ..."; npm install; }
[ -f einstellungen.json ] || cp einstellungen.beispiel.json einstellungen.json
echo
echo " 1 = Echter Live (die Stadt von letztem Mal geht weiter)"
echo " 2 = Probelauf mit erfundenen Zuschauern"
echo " 3 = Echter Live mit NEUER, leerer Stadt"
read -rp "Auswahl (1/2/3): " wahl
if [ "$wahl" = "3" ]; then
  echo "ACHTUNG: Die jetzige Stadt wird geleert. Eine Sicherung kommt in den Ordner data/sicherungen."
  read -rp "Wirklich neu anfangen? Dann ja eintippen: " sicher
  [ "$sicher" = "ja" ] || { echo "Abgebrochen. Starte mit der bisherigen Stadt."; wahl=1; }
fi
if [ "$wahl" = "2" ]; then
  (sleep 2; open http://localhost:3000; open http://localhost:3000/regie.html) & node server.js --demo --neu; exit
fi
echo "Dein TikTok-Name ohne @ (einfach Enter drücken, wenn er in einstellungen.json steht)"
read -rp "Name: " name
(sleep 2; open http://localhost:3000; open http://localhost:3000/regie.html) &
if [ "$wahl" = "3" ]; then node server.js $name --neu; else node server.js $name; fi
