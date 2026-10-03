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
# Deux fichiers (et, avec un troisième argument, des vues de contrôle et la forme de chaque corps) :
#   maillot-zones.png (2048², gris) : la zone de chaque texel — 0 on garde (le fond), 1 maillot, 2 liseré du maillot, 3 short, 4 liseré du
#                                     short, 5 chaussette, 6 peau du bras, 7 main, 8 peau de la jambe, 9 chaussure (6-9 : l'équipement du
#                                     joueur — manche longue, bandage, gants, chaussette haute ou basse, chaussures — se peint dans le shader) ;
#   (la FORME de chaque corps — la position au repos de chaque texel, le relief des plis — la page la tire désormais du maillage chargé, en
#   flottants : gpf-maillots.js formeDuCorps ; l'outil la calcule encore pour ses mesures et ses vues de contrôle)
#   maillot-carte.json : la boîte, les articulations au repos (épaule, coude, poignet, hanche, genou, cheville), les zones d'impression
#                        (le dos tête-bêche, la poitrine, le short) et leur TAILLE RÉELLE (m), l'écusson, le sponsor.
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

    # l'os dominant de chaque sommet → une famille : 1 buste (maillot), 2 bassin, 3 cuisse, 4 mollet, 5 pied, 6 avant-bras, 7 main, 0 tête
    def famille(nom):
        if any(k in nom for k in ('Spine', 'Neck', 'Clavicle', 'UpperArm')): return 1
        if 'Pelvis' in nom: return 2
        if 'Thigh' in nom: return 3
        if 'Calf' in nom: return 4
        if 'Foot' in nom or 'Toe' in nom: return 5
        if 'Forearm' in nom: return 6
        if 'Hand' in nom or 'Finger' in nom: return 7
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
    # LES ZONES DE PEAU ET LES CHAUSSURES (les variantes PAR JOUEUR, posées par le shader : la manche longue sur le bras, la chaussette haute
    # ou basse sur la jambe, le bandage sur la main) — 6 peau du bras (au-delà des îlots du torse), 7 main, 8 peau de la jambe, 9 chaussure ;
    # le haut de la chaussure (au-dessus de 0,125 m) est la chaussette qui y entre
    y = pos[..., 1]
    zones[cou & peau & ~au_torse & ((fam == 6) | (fam == 1))] = 6
    zones[cou & (fam == 7)] = 7
    zones[cou & peau & ~au_torse & ((fam == 3) | (fam == 4))] = 8
    zones[cou & (fam == 5) & ~peau & (y > 0.125)] = 5
    zones[cou & (fam == 5) & ((y <= 0.125) | peau)] = 9

    # le débord : 6 texels autour des îlots, la zone du voisin le plus proche (sur les texels non couverts seulement)
    def deborder(z, couvert, pas=10):
        z = z.copy(); libre = ~couvert
        for _ in range(pas):
            for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                sh = np.roll(np.roll(z, dy, 0), dx, 1)
                prendre = libre & (z == 0) & (sh > 0)
                z[prendre] = sh[prendre]
        return z
    zones = deborder(zones, cou)   # (débordent toutes : la marge d'un îlot de peau lit la peau)

    # le relief : la carte de normales (espace tangent, bleu = z) → l'ombre des plis, 0,62 (pli profond) à 1 (à plat)
    nrm_path = None
    for im in J['images']:
        if im.get('name', '').endswith('body_normal'):
            bv = J['bufferViews'][im['bufferView']]; nrm_path = (BIN + bv.get('byteOffset', 0), bv['byteLength'])
    nm = np.asarray(Image.open(io.BytesIO(b[nrm_path[0]:nrm_path[0] + nrm_path[1]])).convert('RGB').resize((NF, NF), Image.LANCZOS)).astype(np.float32) / 255
    nz = nm[..., 2] * 2 - 1
    t = np.clip((nz - 0.55) / (0.98 - 0.55), 0, 1); relief = 0.62 + 0.38 * t * t * (3 - 2 * t)


    return zones, cou, posF, couF, relief, rgb

resultats = [analyser(g) for g in GLBS]
zones, cou = resultats[0][0].copy(), resultats[0][1].copy()
for z2, c2, *_ in resultats[1:]:
    prendre = (~cou) & (z2 > 0); zones[prendre] = z2[prendre]; cou = cou | c2   # seulement là où le n° 18 ne couvre RIEN (sa peau reste sa peau)
print(f'réunis : {len(GLBS)} corps, {100 * (zones > 0).mean():.2f} % de l\'atlas en zones')

# LA FORME DE CHAQUE CORPS : ses positions (son dépliage) et son relief, complétés par ceux des autres là où il ne couvre rien. Une forme
# commune trompait le n° 10 : dans la bande d'ourlet que seul il utilise, les positions prolongées du n° 18 alignaient les rayures mais pas
# les HAUTEURS — le maillot rentré n'y prenait pas, l'ourlet restait bleu sur le short (vu le 3 octobre) ; chacun lit désormais la sienne.
# SUR 16 BITS : 8 bits faisaient des pas de 6,5 mm en hauteur — la ceinture d'un maillot rentré, la manche longue, le haut d'une chaussette
# dessinés par le shader au pixel près en suivaient les marches (vu de près le 3 octobre). Deux images : les octets forts (RVB, opaques) et
# les octets faibles avec le relief (RVBA : le relief en alpha, ≥ 0,62, ne coûte au plus qu'une unité aux octets faibles au décodage).
# LA MARGE (6 texels autour des îlots, pour le filtrage) est prise au voisin couvert le plus proche — l'ancien test « somme nulle » ne prenait
# jamais (un texel vide valait l'origine, pas zéro) : les bords d'îlots lisaient la position (0, 0, 0)
def dilater(q, couv, pas=6):
    q, couv = q.copy(), couv.copy()
    for _ in range(pas):
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sq, sc = np.roll(np.roll(q, dy, 0), dx, 1), np.roll(np.roll(couv, dy, 0), dx, 1)
            prendre = (~couv) & sc
            q[prendre] = sq[prendre]; couv = couv | prendre
    return q
def forme_de(i):
    _, _, pos, couv, relief, _ = resultats[i]; pos, couv = pos.copy(), couv.copy()
    for j2, (_, _, p2, c2, _, _) in enumerate(resultats):
        if j2 != i: prendre = (~couv) & c2; pos[prendre] = p2[prendre]; couv = couv | c2
    pn = np.clip((pos - BOITE[0]) / (BOITE[1] - BOITE[0]), 0, 1)   # position normalisée dans la boîte
    q = dilater(np.round(pn * 65535).astype(np.uint16), couv)
    fort = (q >> 8).astype(np.uint8)
    faible = np.dstack([(q & 255).astype(np.uint8), (relief * 255 + 0.5).astype(np.uint8)])
    return fort, faible
formes = [forme_de(i) for i in range(len(resultats))]
SUFFIXES = [''] + [f"-{os.path.basename(g).split('-')[1].split('.')[0]}" for g in GLBS[1:]]
NOMS_FORMES = [f'maillot-forme{x}.png' for x in SUFFIXES]; NOMS_FINES = [f'maillot-forme{x}-fin.png' for x in SUFFIXES]
posF = resultats[0][2]   # (les mesures d'impression : le n° 18)

# LA TAILLE RÉELLE DES ZONES D'IMPRESSION (m) : la largeur le long de la rangée du milieu, la hauteur le long de la colonne du milieu (des
# arcs : le dos et la cuisse sont courbes) ; pour le dos, la place de la colonne vertébrale (x = 0) dans la largeur, lue dans le sens du
# flocage (tête-bêche : de x1 vers x0). La page dessine le nom et le numéro à leur taille réelle, centrés sur la colonne
# (le dos : 400 px centrés sur la colonne vertébrale, col. 1021 — l'îlot du dos va de 726 à 1318 entre les rangées 360 et 660, de 804 à 1242
# au-dessus, mesuré le 3 octobre ; l'ancien rectangle, 845-1145, était décalé de 2,5 cm et bridait le numéro)
IMPRESSION = {'dos': [821, 390, 1221, 805], 'poitrine': [958, 1100, 1022, 1172], 'short': [262, 262, 392, 386]}
def arc(pts): return np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))])
mesures = {}
for nom, (x0, y0, x1, y1) in IMPRESSION.items():
    kk = NF / 2048; ym, xm = int((y0 + y1) / 2 * kk), int((x0 + x1) / 2 * kk)
    rang = posF[ym, int(x0 * kk):int(x1 * kk) + 1].astype(np.float64); col = posF[int(y0 * kk):int(y1 * kk) + 1, xm].astype(np.float64)
    m = {'largeur': round(float(arc(rang)[-1]), 4), 'hauteur': round(float(arc(col)[-1]), 4), 'centre': 0.5}
    if nom == 'dos':
        r = rang[::-1]; a = arc(r); i = np.where(np.sign(r[:-1, 0]) != np.sign(r[1:, 0]))[0]
        if len(i): j = i[0]; t = r[j, 0] / (r[j, 0] - r[j + 1, 0]); m['centre'] = round(float((a[j] + t * (a[j + 1] - a[j])) / a[-1]), 4)
    mesures[nom] = m
print('impression (m) :', mesures)

os.makedirs(OUT, exist_ok=True)
# LA DESCRIPTION DE L'ATLAS (maillot-carte.json) : la boîte des positions, les articulations au repos (le même squelette pour les deux corps,
# vérifié), les zones d'impression mesurées — la page la lit avec les cartes (une seule vérité)
b0 = open(GLBS[0], 'rb').read(); jl0 = struct.unpack_from('<I', b0, 12)[0]; J0 = json.loads(b0[20:20 + jl0]); BIN0 = 20 + jl0 + 8
sk = J0['skins'][0]; ac = J0['accessors'][sk['inverseBindMatrices']]; bvv = J0['bufferViews'][ac['bufferView']]
IBM = np.frombuffer(b0, np.float32, ac['count'] * 16, BIN0 + bvv.get('byteOffset', 0) + ac.get('byteOffset', 0)).reshape(-1, 4, 4)
art = {J0['nodes'][j]['name']: [round(float(v), 4) for v in np.linalg.inv(IBM[i].T)[:3, 3]] for i, j in enumerate(sk['joints'])}
desc = {
    'boite': BOITE.tolist(),
    'zones': {'1': 'maillot', '2': 'liseré du maillot', '3': 'short', '4': 'liseré du short', '5': 'chaussette', '6': 'peau du bras', '7': 'main', '8': 'peau de la jambe', '9': 'chaussure'},
    'articulations': {k: art[f'Bip01 {v}'] for k, v in (('epaule', 'L UpperArm'), ('coude', 'L Forearm'), ('poignet', 'L Hand'), ('hanche', 'L Thigh'), ('genou', 'L Calf'), ('cheville', 'L Foot'), ('bassin', 'Pelvis'), ('cou', 'Neck'))},
    'impression': IMPRESSION, 'mesures': mesures,
    'corps': [os.path.basename(g) for g in GLBS],
    'ecusson': {'x': 1065, 'y': 1146, 'd': 86}, 'sponsor': {'x': 995, 'y': 1252, 'w': 236, 'h': 92},
    'note': 'x > 0 : le côté GAUCHE du joueur (il regarde +z). Atlas 2048 px, v vers le bas. Le dos est imprimé tête-bêche.',
}
json.dump(desc, open(f'{OUT}/maillot-carte.json', 'w'), ensure_ascii=False, indent=1)
Image.fromarray(zones, 'L').save(f'{OUT}/maillot-zones.png', optimize=True)

for k, nom in ((1, 'maillot'), (2, 'liseré du maillot'), (3, 'short'), (4, 'liseré du short'), (5, 'chaussette'), (6, 'peau du bras'), (7, 'main'), (8, 'peau de la jambe'), (9, 'chaussure')):
    print(f'  zone {k} {nom:20s} {100 * (zones == k).mean():5.2f} % de l\'atlas')
print('écrit', f'{OUT}/maillot-zones.png', os.path.getsize(f'{OUT}/maillot-zones.png') // 1024, 'Ko ;', f'{OUT}/maillot-carte.json')

if DBG:
    os.makedirs(DBG, exist_ok=True)
    pal = np.array([[0, 0, 0], [40, 120, 255], [255, 60, 30], [40, 220, 90], [250, 220, 40], [220, 60, 230], [255, 150, 60], [255, 255, 255], [120, 60, 20], [60, 230, 230]], np.float32) / 255
    vue = rgb * 0.45 + pal[zones] * 0.55 * (zones > 0)[..., None] + rgb * 0.55 * (zones == 0)[..., None]
    Image.fromarray((np.clip(vue, 0, 1) * 255).astype(np.uint8)).resize((1024, 1024)).save(f'{DBG}/zones.png')
    for (fort, faible), nom, fin in zip(formes, NOMS_FORMES, NOMS_FINES):   # (la page tire la sienne du maillage : formeDuCorps)
        Image.fromarray(fort, 'RGB').save(f'{DBG}/{nom}'); Image.fromarray(faible, 'RGBA').save(f'{DBG}/{fin}')
    Image.fromarray(formes[0][0]).save(f'{DBG}/forme-rgb.png'); Image.fromarray(formes[0][1][..., 3]).save(f'{DBG}/relief.png')
    print('vues de contrôle :', DBG)
