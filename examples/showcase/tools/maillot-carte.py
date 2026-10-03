# maillot-carte.py — LA CARTE DU MAILLOT des footballeurs Rocketbox (lot L5, les maillots de /match11 : EX-27). Les deux corps (n° 18,
# Sports_Male_02 ; n° 10, Sports_Male_03) partagent (presque) le même dépliage de texture et le même dessin de tenue : on lit, sur les deux,
# où sont le maillot, ses liserés, le short, les chaussettes — et ce qui ne bouge pas (la peau, les chaussures, le fond). La page
# (scenes/gpf-maillots.js) repeint ensuite chaque tenue aux couleurs choisies, sur la texture de chaque corps, sans toucher au reste.
#
#   python3 tools/maillot-carte.py [glbs=public/rocketbox/foot-18.glb,public/rocketbox/foot-10-ciel.glb] [sortie=public/rocketbox] [debug=<dossier>]
# LES DEUX CORPS sont tramés et leurs zones réunies : leurs dépliages ne sont pas tout à fait les mêmes (l'ourlet du maillot du n° 10 est
# projeté sur une bande de l'atlas que le n° 18 n'utilise pas — vu le 3 octobre : l'ancienne tenue restait au bas du maillot). Le n° 18 fait
# foi là où les deux couvrent ; chacun est classé sur sa propre texture (le bleu ciel du n° 10 est du tissu, pas de la peau).
#
# Deux fichiers :
#   maillot-zones.png (2048², gris) : la zone de chaque texel — 0 on garde, 1 maillot, 2 liseré du maillot, 3 short, 4 liseré du short,
#                                     5 chaussette ;
#   maillot-forme.png (1024², RGBA) : R, G, B = la position du texel sur le corps au repos (x, y, z normalisés dans BOITE : les rayures,
#                                     les cerceaux, l'écharpe se dessinent dans l'espace du corps, pas de l'atlas) ; A = le relief (l'ombre
#                                     des plis, tirée de la carte de normales : le motif neuf garde les plis du tissu).
# Comment : les triangles du corps sont tramés dans l'espace des UV (l'os dominant de chaque sommet, sa position) ; l'ÎLOT de dépliage
# (triangles reliés par leurs sommets) sépare le bas du maillot du haut du short (tous deux sous le bassin) ; la COULEUR de la texture
# d'origine sépare le tissu (noir, blanc, gris) de la peau (saturée, chaude) et des liserés (rouge vif) ; les inscriptions rouges du sponsor
# restent du tissu (un rectangle mesuré). Enfin les zones débordent de 10 texels hors des îlots (le filtrage de la carte graphique lit la
# marge : sans débord, un fil de l'ancienne tenue courait le long des coutures).
import json, struct, sys, os
import numpy as np
from PIL import Image

GLBS = (sys.argv[1] if len(sys.argv) > 1 else 'public/rocketbox/foot-18.glb,public/rocketbox/foot-10-ciel.glb').split(',')
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/rocketbox'
DBG = sys.argv[3] if len(sys.argv) > 3 else None
N, NF = 2048, 1024
BOITE = np.array([[-0.70, -0.05, -0.20], [0.70, 1.60, 0.25]], np.float32)   # la boîte du corps au repos (m) : x, y, z

def analyser(GLB):
    b = open(GLB, 'rb').read()
    jl = struct.unpack_from('<I', b, 12)[0]; J = json.loads(b[20:20 + jl]); BIN = 20 + jl + 8
    def acc(i):
        a = J['accessors'][i]; bv = J['bufferViews'][a['bufferView']]
        comp = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}[a['componentType']]
        n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        arr = np.frombuffer(b, comp, a['count'] * n, BIN + bv.get('byteOffset', 0) + a.get('byteOffset', 0))
        return arr.reshape(-1, n) if n > 1 else arr
    prim = next(p for p in J['meshes'][0]['primitives'] if J['materials'][p['material']]['name'] == 'body')
    P = acc(prim['attributes']['POSITION']).astype(np.float32)
    UV = acc(prim['attributes']['TEXCOORD_0']).astype(np.float32)
    JO = acc(prim['attributes']['JOINTS_0']).astype(np.int32)
    W = acc(prim['attributes']['WEIGHTS_0']).astype(np.float32)
    I = acc(prim['indices']).astype(np.int64).reshape(-1, 3)
    noms = [J['nodes'][i]['name'] for i in J['skins'][0]['joints']]

    # l'os dominant de chaque sommet → une famille : 1 buste (maillot), 2 bassin, 3 cuisse, 4 mollet, 5 pied, 6 bras et main, 0 tête
    def famille(nom):
        if any(k in nom for k in ('Spine', 'Neck', 'Clavicle', 'UpperArm')): return 1
        if 'Pelvis' in nom: return 2
        if 'Thigh' in nom: return 3
        if 'Calf' in nom: return 4
        if 'Foot' in nom or 'Toe' in nom: return 5
        if any(k in nom for k in ('Forearm', 'Hand', 'Finger')): return 6
        return 0
    FAM = np.array([famille(n) for n in noms], np.int32)
    fam_v = FAM[JO[np.arange(len(JO)), W.argmax(1)]]

    # les îlots de dépliage : triangles reliés par un sommet commun (les coutures UV dédoublent les sommets)
    par = np.arange(len(P))
    def racine(i):
        while par[i] != i: par[i] = par[par[i]]; i = par[i]
        return i
    for t in I:
        a, c = racine(t[0]), racine(t[1]); par[c] = a
        c = racine(t[2]); par[c] = a
    ilot_v = np.array([racine(i) for i in range(len(P))])
    ilot_t = ilot_v[I[:, 0]]
    # un îlot de SHORT : la cuisse y pèse (plus de 20 % des sommets) — sous le bassin, le reste est le bas du maillot (son ourlet est parfois un
    # îlot à lui, sans cuisse : c'est le cas du n° 10)
    # …et un îlot de TORSE (le buste y domine, plus de 40 %) est tout entier du maillot : l'ourlet plus long du n° 10 est pondéré sur les cuisses
    cuisse, torse = set(), set()
    for il in np.unique(ilot_t):
        f = fam_v[I[ilot_t == il].ravel()]
        if (f == 3).mean() > 0.2: cuisse.add(il)
        if (f == 1).mean() > 0.4: torse.add(il)
    print(f'{GLB} : {len(P)} sommets, {len(I)} triangles, {len(np.unique(ilot_t))} îlots, dont short : {len(cuisse)}, torse : {len(torse)}')

    # le tramage dans l'espace UV (pixel = uv × taille ; v vers le bas, comme glTF et la texture)
    def tramer(S):
        fam = np.zeros((S, S), np.int8); pos = np.zeros((S, S, 3), np.float32); cou = np.zeros((S, S), bool); isl = np.full((S, S), -1, np.int64)
        for k, t in enumerate(I):
            u = UV[t] * S - 0.5
            x0, x1 = max(0, int(np.floor(u[:, 0].min()))), min(S - 1, int(np.ceil(u[:, 0].max())))
            y0, y1 = max(0, int(np.floor(u[:, 1].min()))), min(S - 1, int(np.ceil(u[:, 1].max())))
            if x1 < x0 or y1 < y0: continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1, dtype=np.float32), np.arange(y0, y1 + 1, dtype=np.float32))
            (ax, ay), (bx, by), (cx, cy) = u
            d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(d) < 1e-12: continue
            l0 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / d
            l1 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / d
            l2 = 1 - l0 - l1
            dans = (l0 >= -1e-4) & (l1 >= -1e-4) & (l2 >= -1e-4)
            if not dans.any(): continue
            ys, xs = gy[dans].astype(int), gx[dans].astype(int)
            L = np.stack([l0[dans], l1[dans], l2[dans]], 1)
            pos[ys, xs] = L @ P[t]
            fam[ys, xs] = fam_v[t][L.argmax(1)]
            cou[ys, xs] = True; isl[ys, xs] = ilot_t[k]
        return fam, pos, cou, isl
    fam, pos, cou, isl = tramer(N)
    famF, posF, couF, _ = tramer(NF)
    print(f'couverture : {100 * cou.mean():.1f} % de l\'atlas')

    # la couleur d'origine (le n° 18 : tissu noir et blanc, liserés rouges, peau)
    tex_path = None
    for k, im in enumerate(J['images']):
        if im.get('name', '').endswith('body_color'):
            bv = J['bufferViews'][im['bufferView']]; tex_path = (BIN + bv.get('byteOffset', 0), bv['byteLength'])
    import io
    rgb = np.asarray(Image.open(io.BytesIO(b[tex_path[0]:tex_path[0] + tex_path[1]])).convert('RGB').resize((N, N))).astype(np.float32) / 255
    mx, mn = rgb.max(2), rgb.min(2); v = mx; s = np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0)
    r, g, bb = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.degrees(np.arctan2(np.sqrt(3) * (g - bb), 2 * r - g - bb)) % 360
    # le liseré : un rouge VIF et très saturé (≈ RGB 230, 60, 20) — la peau foncée du n° 10, saturée elle aussi, n'en est pas ; la peau : une
    # teinte chaude, même sombre (les ombres de la peau foncée)
    rouge = (s > 0.75) & (v > 0.45) & ((h < 22) | (h > 345))
    peau = (~rouge) & (s > 0.18) & (v > 0.08) & (h > 4) & (h < 50)
    # le sponsor (« FYA MOTORS », rouge) et l'écusson du devant restent du TISSU : mesurés sur l'atlas (px 2048)
    sponsor = np.zeros((N, N), bool); sponsor[1170:1345, 840:1135] = True; sponsor[1085:1205, 1010:1125] = True   # (l'ellipse du sponsor va jusqu'à x 1115)

    zones = np.zeros((N, N), np.uint8)
    au_short, au_torse = np.isin(isl, list(cuisse)), np.isin(isl, list(torse))
    # LES BANDES D'OURLET de la colonne du maillot (mesurées : x 640-1330 px, au-dessus de 240 et sous 1680 — le bas du dos et le bas du
    # devant) : sous le bassin, ce qui y tombe est du maillot — le bord de l'ourlet du n° 10 (pondéré bassin et cuisses, sur un îlot à
    # cuisses) y lit la marge. Pas plus large : les fines bandes voisines (x 560-700) portent un panneau intérieur du SHORT
    colonne = np.zeros((N, N), bool); colonne[:240, 640:1330] = True; colonne[1680:, 640:1330] = True
    maillot = cou & (au_torse | (fam == 1) | ((fam == 2) & ~au_short) | (((fam == 2) | (fam == 3)) & colonne))
    short = cou & ~au_torse & ~colonne & ((fam == 3) | ((fam == 2) & au_short))
    chaussette = cou & ~au_torse & (fam == 4)
    zones[maillot & ~peau] = 1
    # les îlots du TORSE n'ont pas de peau : tout y est tissu — les bords adoucis des lettres rouges du sponsor et l'anneau doré de l'écusson
    # ont des teintes chaudes que le test de la peau prenait (vu le 3 octobre : « FYA MOTORS » en contour sous le nouveau sponsor)
    zones[maillot & au_torse] = 1
    zones[maillot & rouge & ~sponsor] = 2
    zones[short & ~peau] = 3
    zones[short & rouge] = 4
    zones[chaussette & ~peau] = 5

    # le débord : 6 texels autour des îlots, la zone du voisin le plus proche (sur les texels non couverts seulement)
    def deborder(z, couvert, pas=10):
        z = z.copy(); libre = ~couvert
        for _ in range(pas):
            for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                sh = np.roll(np.roll(z, dy, 0), dx, 1)
                prendre = libre & (z == 0) & (sh > 0)
                z[prendre] = sh[prendre]
        return z
    zones = deborder(zones, cou)

    # le relief : la carte de normales (espace tangent, bleu = z) → l'ombre des plis, 0,62 (pli profond) à 1 (à plat)
    nrm_path = None
    for im in J['images']:
        if im.get('name', '').endswith('body_normal'):
            bv = J['bufferViews'][im['bufferView']]; nrm_path = (BIN + bv.get('byteOffset', 0), bv['byteLength'])
    nm = np.asarray(Image.open(io.BytesIO(b[nrm_path[0]:nrm_path[0] + nrm_path[1]])).convert('RGB').resize((NF, NF), Image.LANCZOS)).astype(np.float32) / 255
    nz = nm[..., 2] * 2 - 1
    t = np.clip((nz - 0.55) / (0.98 - 0.55), 0, 1); relief = 0.62 + 0.38 * t * t * (3 - 2 * t)


    return zones, cou, posF, couF, relief, rgb

def etendre(pos, couvert, pas):
    """Prolonger des positions dans les texels non couverts (le voisin le plus proche, `pas` texels) : rend (pos, couvert)."""
    pos, couvert = pos.copy(), couvert.copy()
    for _ in range(pas):
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sp, sc = np.roll(np.roll(pos, dy, 0), dx, 1), np.roll(np.roll(couvert, dy, 0), dx, 1)
            prendre = (~couvert) & sc
            pos[prendre] = sp[prendre]; couvert = couvert | prendre
    return pos, couvert

resultats = [analyser(g) for g in GLBS]
zones, cou, posF, couF, relief, rgb = resultats[0]
# LES POSITIONS DU N° 18 PROLONGÉES (40 texels à 1024) avant celles du n° 10 : dans la bande d'ourlet que seul le n° 10 utilise, les rayures
# continuent ainsi celles du dessus, droites, pour les deux corps — avec les positions du n° 10, elles s'y décalaient (un corps n'est pas
# l'autre) et le filtrage du bord de l'ourlet mêlait les deux : des dents blanches au bas du maillot (vu le 3 octobre)
posF, couF = etendre(posF, couF, 40)
for z2, c2, p2, cf2, _, _ in resultats[1:]:
    prendre = (~cou) & (z2 > 0); zones[prendre] = z2[prendre]; cou = cou | c2   # seulement là où le n° 18 ne couvre RIEN (sa peau reste sa peau)
    pf = (~couF) & cf2; posF[pf] = p2[pf]; couF = couF | cf2
print(f'réunis : {len(GLBS)} corps, {100 * (zones > 0).mean():.2f} % de l\'atlas en zones')

# la forme : position normalisée dans la boîte (débordée elle aussi, pour la marge)
pn = np.clip((posF - BOITE[0]) / (BOITE[1] - BOITE[0]), 0, 1)
forme = np.zeros((NF, NF, 4), np.uint8)
forme[..., :3] = (pn * 255 + 0.5).astype(np.uint8)
forme[..., 3] = (relief * 255 + 0.5).astype(np.uint8)
libre = ~couF
for _ in range(6):
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        sh = np.roll(np.roll(forme, dy, 0), dx, 1)
        prendre = libre & (forme[..., :3].sum(2) == 0) & (sh[..., :3].sum(2) > 0)
        forme[prendre, :3] = sh[prendre, :3]

os.makedirs(OUT, exist_ok=True)
Image.fromarray(zones, 'L').save(f'{OUT}/maillot-zones.png', optimize=True)
Image.fromarray(forme, 'RGBA').save(f'{OUT}/maillot-forme.png', optimize=True)
for k, nom in ((1, 'maillot'), (2, 'liseré du maillot'), (3, 'short'), (4, 'liseré du short'), (5, 'chaussette')):
    print(f'  zone {k} {nom:20s} {100 * (zones == k).mean():5.2f} % de l\'atlas')
print('écrit', f'{OUT}/maillot-zones.png', os.path.getsize(f'{OUT}/maillot-zones.png') // 1024, 'Ko ;', f'{OUT}/maillot-forme.png', os.path.getsize(f'{OUT}/maillot-forme.png') // 1024, 'Ko')

if DBG:
    os.makedirs(DBG, exist_ok=True)
    pal = np.array([[0, 0, 0], [40, 120, 255], [255, 60, 30], [40, 220, 90], [250, 220, 40], [220, 60, 230]], np.float32) / 255
    vue = rgb * 0.45 + pal[zones] * 0.55 * (zones > 0)[..., None] + rgb * 0.55 * (zones == 0)[..., None]
    Image.fromarray((np.clip(vue, 0, 1) * 255).astype(np.uint8)).resize((1024, 1024)).save(f'{DBG}/zones.png')
    Image.fromarray(forme[..., :3]).save(f'{DBG}/forme-rgb.png'); Image.fromarray(forme[..., 3]).save(f'{DBG}/relief.png')
    print('vues de contrôle :', DBG)
