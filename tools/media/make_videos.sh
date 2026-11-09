#!/usr/bin/env bash
# Baut aus frames/vN_*.png je ein 1080x1920-Video (ohne Ton: Trend-Sound in der TikTok-App hinzufügen)
set -euo pipefail
cd "$(dirname "$0")"; OUT=../../marketing/videos; mkdir -p "$OUT"
DUR=(2.6 3.2 3.0 2.8)   # Sekunden pro Frame: Hook, Inhalt, Pointe, CTA
for v in v1 v2 v3 v4 v5; do
  inputs=(); filt=""; 
  for i in 0 1 2 3; do
    d=${DUR[$i]}; n=$(python3 -c "print(int($d*30))")
    inputs+=(-i "frames/${v}_${i}.png")
    filt+="[$i:v]scale=1188:2112,zoompan=z='min(zoom+0.0009,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$n:s=1080x1920:fps=30,setsar=1,format=yuv420p[s$i];"
  done
  # Überblendungen (0.35 s)
  o1=$(python3 -c "print(${DUR[0]}-0.35)"); o2=$(python3 -c "print(${DUR[0]}+${DUR[1]}-0.7)"); o3=$(python3 -c "print(${DUR[0]}+${DUR[1]}+${DUR[2]}-1.05)")
  filt+="[s0][s1]xfade=transition=slideup:duration=0.35:offset=$o1[x1];[x1][s2]xfade=transition=fade:duration=0.35:offset=$o2[x2];[x2][s3]xfade=transition=slideup:duration=0.35:offset=$o3[out]"
  ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex "$filt" -map "[out]" -c:v libx264 -preset medium -crf 20 -movflags +faststart "$OUT/tiktok_$v.mp4"
  echo "$OUT/tiktok_$v.mp4"
done
