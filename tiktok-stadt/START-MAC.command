#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null; then
  echo "Node.js fehlt. Bitte installieren: https://nodejs.org (LTS-Version), danach erneut starten."
  read -r; exit 1
fi
[ -d node_modules/@anthropic-ai ] || { echo "Installation, dauert ca. 1 Minute ..."; npm install; }
[ -f einstellungen.json ] || cp einstellungen.beispiel.json einstellungen.json
echo
echo " 1 = Echter Live"
echo " 2 = Probelauf mit erfundenen Zuschauern"
echo " 3 = Echter Live, Stadt vorher leeren"
read -rp "Auswahl (1/2/3): " wahl
if [ "$wahl" = "2" ]; then
  (sleep 2; open http://localhost:3000; open http://localhost:3000/regie.html) & node server.js --demo --neu; exit
fi
read -rp "Dein TikTok-Name (ohne @): " name
(sleep 2; open http://localhost:3000; open http://localhost:3000/regie.html) &
if [ "$wahl" = "3" ]; then node server.js "$name" --neu; else node server.js "$name"; fi
