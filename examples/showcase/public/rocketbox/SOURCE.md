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
