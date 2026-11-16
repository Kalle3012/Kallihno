"""Erzeugt den Ton für das Werbevideo.

1. Liest werbung/sprechertext.json und spricht jeden Satz mit Piper (freie deutsche Computerstimme).
2. Legt fest, wann welche Szene beginnt (so lange, wie gesprochen wird) -> public/werbung-zeiten.json
3. Erzeugt eine eigene, lizenzfreie Hintergrundmusik.
4. Schreibt werbung/ton/sprecher.wav und werbung/ton/musik.wav

Aufruf:  python3 werbung/ton-bauen.py --piper <pfad/zu/piper> --stimme <pfad/zu/de-thorsten-low.onnx>
"""
import argparse
import array
import json
import math
import random
import subprocess
import tempfile
import wave
from pathlib import Path

HIER = Path(__file__).resolve().parent
TON = HIER / 'ton'
ZEITEN = HIER.parent / 'public' / 'werbung-zeiten.json'

START = 0.4           # Sekunden Stille am Anfang
PAUSE_SATZ = 0.3      # Pause zwischen Sätzen
PAUSE_SZENE = 0.45    # zusätzliche Pause am Szenenende
NACHLAUF = 1.6        # Sekunden nach dem letzten Satz


def sprechen(piper, stimme, text, ziel):
    subprocess.run([piper, '-m', stimme, '-f', str(ziel), '--length-scale', '0.92', '--sentence-silence', '0.1'],
                   input=text.encode('utf-8'), check=True, capture_output=True)
    with wave.open(str(ziel)) as w:
        return w.getnframes() / w.getframerate(), w.getframerate(), w.readframes(w.getnframes())


def musik(dauer, rate=44100):
    """Fröhlicher, leiser Pop-Beat: Akkorde Am–F–C–G, Bass, Kick, Hi-Hat, Glöckchen-Melodie."""
    bpm = 112
    schlag = 60 / bpm
    n = int(dauer * rate)
    out = [0.0] * n
    random.seed(7)

    def note(freq, start, laenge, lautst, form='dreieck', abkling=3.0):
        s0, s1 = int(start * rate), min(n, int((start + laenge) * rate))
        for i in range(s0, s1):
            t = (i - s0) / rate
            phase = (freq * t) % 1.0
            if form == 'dreieck':
                v = 4 * abs(phase - 0.5) - 1
            else:
                v = math.sin(2 * math.pi * phase)
            huelle = min(1.0, t / 0.01) * math.exp(-abkling * t)
            out[i] += v * lautst * huelle

    akkorde = [  # (Grundton Bass, Akkordtöne)
        (110.00, [220.00, 261.63, 329.63]),   # Am
        (87.31, [174.61, 220.00, 261.63]),    # F
        (130.81, [261.63, 329.63, 392.00]),   # C
        (98.00, [196.00, 246.94, 293.66]),    # G
    ]
    melodie = [659.25, 587.33, 523.25, 587.33, 659.25, 783.99, 659.25, 523.25]
    takte = int(dauer / (4 * schlag)) + 1
    for takt in range(takte):
        bass, toene = akkorde[takt % 4]
        t0 = takt * 4 * schlag
        for f in toene:
            note(f, t0, 4 * schlag, 0.05, 'dreieck', 0.6)
        for b in range(4):
            tb = t0 + b * schlag
            note(bass, tb, schlag * 0.9, 0.16, 'sinus', 4.0)
            # Kick: abfallender Sinus
            s0 = int(tb * rate)
            for i in range(s0, min(n, s0 + int(0.18 * rate))):
                t = (i - s0) / rate
                out[i] += math.sin(2 * math.pi * (50 + 90 * math.exp(-t * 30)) * t) * 0.35 * math.exp(-t * 18)
            # Hi-Hat auf den Zwischenschlägen
            s0 = int((tb + schlag / 2) * rate)
            vorher = 0.0
            for i in range(s0, min(n, s0 + int(0.05 * rate))):
                t = (i - s0) / rate
                r = random.uniform(-1, 1)
                out[i] += (r - vorher) * 0.05 * math.exp(-t * 70)
                vorher = r
        if takt >= 2:  # Glöckchen ab dem dritten Takt
            for k in range(2):
                note(melodie[(takt * 2 + k) % len(melodie)], t0 + k * 2 * schlag + schlag, schlag * 1.5, 0.06, 'sinus', 3.5)

    # Ein- und Ausblenden, normalisieren
    spitze = max(1e-6, max(abs(v) for v in out))
    pcm = array.array('h')
    for i, v in enumerate(out):
        t = i / rate
        blende = min(1.0, t / 1.0, (dauer - t) / 1.5)
        pcm.append(int(max(-1, min(1, v / spitze * 0.9 * max(0.0, blende))) * 32767))
    return rate, pcm.tobytes()


def wav_schreiben(ziel, rate, daten):
    with wave.open(str(ziel), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(daten)


def main():
    a = argparse.ArgumentParser()
    a.add_argument('--piper', required=True)
    a.add_argument('--stimme', required=True)
    args = a.parse_args()

    text = json.loads((HIER / 'sprechertext.json').read_text(encoding='utf-8'))
    TON.mkdir(exist_ok=True)
    zeit = START
    szenen = []
    stuecke = []
    rate = None
    with tempfile.TemporaryDirectory() as tmp:
        for si, saetze in enumerate(text['szenen']):
            von = zeit if si else 0.0
            liste = []
            for k, satz in enumerate(saetze):
                dauer, r, daten = sprechen(args.piper, args.stimme, satz.get('aussprache', satz['text']), Path(tmp) / f'{si}_{k}.wav')
                rate = rate or r
                stuecke.append((zeit, daten))
                liste.append({'start': round(zeit, 3), 'dauer': round(dauer, 3), 'text': satz['text']})
                print(f'{zeit:6.2f}s  {satz["text"]}')
                zeit += dauer + PAUSE_SATZ
            zeit += PAUSE_SZENE
            szenen.append({'von': round(von, 3), 'bis': round(zeit, 3), 'saetze': liste})
    gesamt = zeit + NACHLAUF
    szenen[-1]['bis'] = round(gesamt + 1, 3)

    # Sprecherspur zusammensetzen
    leer = bytearray(int(gesamt * rate) * 2)
    for start, daten in stuecke:
        pos = int(start * rate) * 2
        leer[pos:pos + len(daten)] = daten
    wav_schreiben(TON / 'sprecher.wav', rate, bytes(leer[:int(gesamt * rate) * 2]))

    m_rate, m_daten = musik(gesamt)
    wav_schreiben(TON / 'musik.wav', m_rate, m_daten)

    ZEITEN.write_text(json.dumps({'dauer': round(gesamt, 3), 'szenen': szenen}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'Gesamtlänge: {gesamt:.1f} s  ->  {ZEITEN}')


if __name__ == '__main__':
    main()
