#!/bin/sh
# Les données que le moteur ouvre réellement en mode sans rendu (relevé par strace sur la version native, 2 octobre 2026),
# copiées dans build/data — les images .bmp remplacées par un BMP 2×2 du même nom : le rendu factice ne les dessine pas,
# le moteur doit seulement pouvoir les charger. Toutes les animations (.anim) sont gardées.
set -e
cd "$(dirname "$0")"
D=build/data; rm -rf $D; mkdir -p $D
mkdir -p $D/media && cp -r upstream/data/media/animations $D/media/
# NOTRE RÉPERTOIRE : les gestes de notre moteur convertis au format du corps (outils/vers-gpf.mjs), marqués specialvar1 — le
# corps charge tout fichier .anim de ce dossier, et ne les joue que sur demande (intention GESTE)
mkdir -p $D/media/animations/gestes && cp gestes/*.anim $D/media/animations/gestes/ 2>/dev/null || true
python3 - <<'PY'
import os, shutil, struct
D = 'build/data'; U = 'upstream/data'
files = [l.strip() for l in open('data-files.txt') if l.strip() and not l.startswith('#')]
# un BMP 24 bits 2×2 (54 octets d'en-tête + 2 lignes de 8 octets)
row = bytes([128, 128, 128] * 2) + b'\0\0'
bmp = b'BM' + struct.pack('<IHHI', 54 + len(row) * 2, 0, 0, 54) + struct.pack('<IiiHHIIiiII', 40, 2, 2, 1, 24, 0, len(row) * 2, 2835, 2835, 0, 0) + row * 2
n = big = 0
for f in files:
  src, dst = os.path.join(U, f), os.path.join(D, f)
  os.makedirs(os.path.dirname(dst), exist_ok=True)
  if f.lower().endswith('.bmp'): open(dst, 'wb').write(bmp)
  else: shutil.copyfile(src, dst); big += os.path.getsize(src)
  n += 1
print(f'données : {n} fichiers hors animations, {big // 1024} Ko utiles')
PY
# la police que le moteur exige au démarrage (il construit ses pages d'interface même sans les afficher) : DejaVu Sans Mono du
# système (licence Bitstream Vera + domaine public, jointe) — aucune police du dépôt de Gameplay Football n'est embarquée
F=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf
[ -f $F ] || { echo "police absente : apt install fonts-dejavu-core"; exit 1; }
mkdir -p $D/media/fonts/dejavu && cp $F $D/media/fonts/dejavu/ && cp /usr/share/doc/fonts-dejavu-core/copyright $D/media/fonts/dejavu/LICENSE
du -sh $D
