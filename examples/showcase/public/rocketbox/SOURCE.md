# Personnages Rocketbox

Microsoft Rocketbox Avatar Library (https://github.com/microsoft/Microsoft-Rocketbox, licence MIT — `LICENSE-Rocketbox.md`).
Squelette 3ds Max Biped (`Bip01`, 80 os dont visage et doigts), lié en A, regarde +Z, mètres réels. Le moteur les présente
comme le rig de référence par `engine/rig-bip01.js` (noms, topologie, pose de repos).

| fichier | avatar | d'où |
| --- | --- | --- |
| `foot-18.glb` | Professions/Sports_Male_02 (m301) — tenue de foot rayée noir et blanc, n° 18 | converti ici |
| `foot-10-ciel.glb` | Professions/Sports_Male_03 (m300) — la même tenue, blancs passés en BLEU CIEL, n° 10 | converti ici |
| `joe.glb` | Professions/Wood_Male_01 (m110) — vêtements de ville | conversion de dgreenheck/tidewater (1438b1a) |
| `marta.glb` | Adults/Female_Adult_04 (f004) — vêtements de ville | conversion de dgreenheck/tidewater (1438b1a) |

Conversion (2026-09-24) : FBX + TGA depuis `raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/Assets/Avatars/…`
(l'URL LFS « media » répond 404) ; textures par `tools/rocketbox-textures.py <Textures> <out> <préfixe> [--ciel]` (corps 2048²,
tête 1024², ORM de tidewater : R 1, G = 0,92 − 0,6·spéculaire, B 0 ; `--ciel` : les blancs du maillot — clairs et peu saturés —
en bleu ciel, ombrage conservé) ; puis Blender 4.2 LTS et le convertisseur de tidewater
(`tools/characters/convert.py`, MIT) sans clips : `blender -b --python convert.py -- <avatar.fbx> <out> <préfixe> <sortie.glb>`.

## Les cartes du maillot (lot L5, /match11)

Produites par `tools/maillot-carte.py` sur les deux footballeurs (leurs dépliages diffèrent à l'ourlet du maillot ; le n° 18 fait foi) :

- `maillot-zones.png` (2048², une zone par texel) : 0 on garde (le fond), 1 maillot, 2 liseré, 3 short, 4 liseré du short, 5 chaussette,
  6 peau du bras, 7 main, 8 peau de la jambe, 9 chaussure ;
- `maillot-forme.png` (1024²) : la position du texel sur le corps au repos (RVB dans la boîte du JSON), et le relief des plis (A) ;
- `maillot-carte.json` : la boîte, les articulations au repos (épaule, coude, poignet, hanche, genou, cheville : le même squelette pour
  les deux corps), les zones d'impression (le dos tête-bêche, centré sur la colonne vertébrale ; la poitrine ; le short) et leur taille
  réelle en mètres (`mesures`), l'écusson, le sponsor.

La page (`src/scenes/gpf-maillots.js`) repeint la tenue de chaque équipe (zones 1-5 : motifs du maillot, du short, des chaussettes,
écusson, sponsor) ; le shader du joueur, commun aux 22, pose son équipement sur les zones 6-9 et la forme (manches longues ou
sous-maillot, maillot rentré, chaussettes hautes ou basses, antidérapantes, strap, cuissard, chaussures, bandage, gants, brassard) et
son flocage (un alphabet en champ de distance, à taille réelle). À refaire si un corps change : `python3 tools/maillot-carte.py`
(vues de contrôle avec un troisième argument).
