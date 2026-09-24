# À RECULONS → engine/foulee-rbds.js : RECUL_REF, la foulée arrière par vitesse (le pendant d'APPUI_REF + le vol).
#
# LA MARCHE À RECULONS est MESURÉE (recul-scherpereel.json : Scherpereel et al. 2023, 10 sujets, 154-192 cycles à 0,6 / 0,8 / 1,0 m/s,
# recul-mesure.py) : le vol (cuisse, genou, cheville), le pied en appui, le bassin sur le demi-cycle, la vitesse sol de la cheville à la pose.
# Deux nombres y sont des RAPPORTS aux mêmes sujets marchant en avant (normal_walk 0,6 / 1,2 m/s, interpolée) — ils se transportent sur la
# marche avant du moteur (WBDS) : la cadence (arrière / avant : 1,19-1,25). L'appui est celui de la FORCE (> 50 N), la définition des courbes
# qu'il découpe (la marche avant du moteur est aux évènements cinématiques de Zeni, et ses courbes aussi : chaque sens est cohérent avec
# lui-même — le rapport 0,97-0,99 à la marche avant transporté sur Zeni, 0,69, prenait le genou des marcheurs APRÈS leur décollage, 15° pour 4 ;
# un seuil cinématique de hauteur sur tapis ne vaut rien à ces allures : le pied en vol rase à < 1 cm).
#
# LA COURSE À RECULONS est ASSEMBLÉE (aucun jeu de données public au-delà de 1 m/s) — chaque nombre a sa source :
#   · cadence (rapport à la course avant, mêmes sujets) et appui : Brennan et al. 2026 (Eur J Sport Sci e70255, 16 athlètes, force + capture,
#     lus sur leurs figures ±5 %) — 1,22 / 1,23 / 1,29 / 1,37 et 0,368 / 0,342 / 0,310 / 0,300 à 2 / 3 / 4 / 5 m/s ;
#   · la FORME des courbes (vol, pied en appui, bassin) : 100STYLE (Mason et al. 2022, Zenodo 8127870, CC BY 4.0 — un acteur, combinaison
#     inertielle, course arrière à ~1 m/s ; recul-100style.py → recul-100style.json). Sa marche arrière tombe sur Scherpereel à quelques degrés.
#   · les bouts de l'appui à 2,7 m/s : Bates, Morrison & Hamill 1986 (figures, U. Oregon) — genou 40° à la pose tenu jusqu'à mi-appui puis
#     tendu (2°) au décollage, pied posé sur la pointe (cheville 25° en flexion plantaire, jambe inclinée : −65° au monde), talon qui descend
#     à mi-appui, décollage sur l'avant-pied (−29°). Géométrie recoupée par Arata 1999 (hanche → orteil 26 % de la jambe à la pose, 46 % au
#     décollage, 5,1 m/s).
#   · l'amplitude à 5,1 m/s : Arata 1999 (30 athlètes) — amplitude du genou 83° (pic de vol ~85°), de la hanche 42°.
#   · le rebond : Cavagna, Legramandi & La Torre 2012 (J Exp Biol 215:75) — oscillation verticale du centre de masse 8,0 / 7,2 / 6,0 cm à
#     2 / 3 / 4 m/s (≈ 5,1 à 5 m/s), jambe ~0,9 m.
# Le NIVEAU moyen du bassin en course arrière n'est pas publié : il est calé dans le moteur (compare-recul.mjs) pour que le genou se pose à
# ~40° (Bates) — BASSIN_BR ci-dessous. Le bassin de course a la forme d'un ressort (creux à mi-appui, sommet à mi-vol), la cuisse de 100STYLE
# voit son excursion au-delà de la corde décollage → pose mise à l'échelle de l'amplitude (100STYLE 18° à 1 m/s → Arata 42° à 5,1 m/s).
# Usage : python3 recul-vers-moteur.py recul-scherpereel.json recul-100style.json <engine>/foulee-rbds.js
import json, re, sys, numpy as np
S = json.load(open(sys.argv[1])); B = json.load(open(sys.argv[2])); p = sys.argv[3]; src = open(p).read()
r1 = lambda a, d=1: np.round(np.asarray(a, float), d).tolist()
res = lambda a, n: np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(a)), a)
lin = lambda v, pts: float(np.interp(v, [x for x, _ in pts], [y for _, y in pts]))

# ---- la marche arrière (mesurée)
m = re.search(r"export const APPUI_REF = \{\n  v: (\[.*?\]),\n  duty: (\[.*?\]),", src, flags=re.S); AV, AD = json.loads(m.group(1)), json.loads(m.group(2))
dutyMoteur = lambda v: float(np.interp(v, AV, AD))
fw = lambda k, v: float(np.interp(v, [S['avant-0.6']['v'], S['avant-1.2']['v']], [S['avant-0.6'][k], S['avant-1.2'][k]]))
hal = lambda c: [(c[i] + c[(i + 50) % 100]) / 2 for i in range(51)]
BW = [S[k] for k in ('recul-0.6', 'recul-0.8', 'recul-1.0')]
V, CAD, DUTY, PIED, HANCHE, META, CUI, GEN, CHE, VSOL = [], [], [], [], [], [], [], [], [], []
for r in BW:
    v = r['v']; V.append(round(v, 3)); CAD.append(round(r['f'] / fw('f', v), 3)); DUTY.append(round(r['duty'], 3))   # l'appui À LA FORCE, celui des courbes
    # le bassin sur le demi-cycle, RECALÉ sur l'appui de la table : le décollage de l'autre pied tombe à (appui − ½) — celui des marcheurs à la
    # force (0,63) devient celui de la table (0,69) ; lu tel quel, le moteur prenait le bassin trop tard (le genou décollait à 15° pour 4)
    hc = np.array(hal(r['hancheCycle'])); t = np.linspace(0, 0.5, 51); dM, dT = r['duty'] - 0.5, DUTY[-1] - 0.5
    tau = np.where(t <= dT, t * dM / dT, dM + (t - dT) * (0.5 - dM) / (0.5 - dT))
    PIED.append(r1(r['piedAppui'])); HANCHE.append(r1(np.interp(tau, t, hc), 4)); META.append([0.0] * 21)
    CUI.append(r1(r['volCuisse'])); GEN.append(r1(r['volGenou'])); CHE.append(r1(r['volCheville'])); VSOL.append(round(-r['vsolCheville'] / v, 2))

# ---- la course arrière (assemblée)
b = B['BR']; n = len(b['genou']) - 1; iTO = int(round(b['appui'] * n))
st = lambda k: res(b[k][:iTO + 1], 21); sw = lambda k: res(b[k][iTO:], 21)
jambe = np.array(b['cuisse']) - np.array(b['genou'])                 # angle global de la jambe (+ = cheville devant le genou)
che100 = res((np.array(b['pied']) - jambe)[iTO:], 21)               # la cheville en vol = pied − jambe (convention marche-mesure)
pied100, cui100, gen100 = st('pied'), sw('cuisse'), sw('genou')
v0 = abs(b['v'])
# le bassin de course : le rebond d'un ressort (Cavagna) — creux à mi-appui, sommet à mi-vol, un cosinus de période ½ cycle (celui de 100STYLE,
# à 1 m/s, est pris sans vol : appui 0,50 — il ne se transporte pas sur un appui de 0,31-0,37)
# …et le creux vient TARD dans l'appui : à reculons l'atterrissage est doux et le décollage dur (t_frein > t_poussée, Cavagna et al. 2011 ; 2012 :
# « the landing–takeoff asymmetry is reversed in backward running ») — creux à 0,58 de l'appui (t_frein / t_poussée ≈ 1,4), sommet à mi-vol
CREUX = 0.58
def ressort(duty):                                                   # −1 au creux (0,58 de l'appui), 0 au sommet (mi-vol), cosinus par morceaux
    t = np.linspace(0, 0.5, 51); tm = CREUX * duty; tt = duty + (0.5 - duty) / 2; d2 = tt - tm; d1 = 0.5 - d2
    x = np.where(t <= tm, (tm - t) / d1, np.where(t <= tt, (t - tm) / d2, 1 - (t - tt) / d1))   # 0 au creux, 1 au sommet (la descente d'avant la pose : durée d1)
    return -0.5 - 0.5 * np.cos(np.pi * x)
chord = lambda c: np.linspace(c[0], c[-1], len(c))
BR = [(2.0, 1.22, 0.368, 0.080), (3.0, 1.23, 0.342, 0.072), (4.0, 1.29, 0.310, 0.060), (5.0, 1.37, 0.300, 0.051)]   # v, cadence (Brennan), appui (Brennan), rebond CdM m (Cavagna)
JAMBE_CAVAGNA = 0.90
BASSIN_BR = float(__import__('os').environ.get('BASSIN_BR', '0.02'))   # le haut du rebond, en longueurs de jambe sous la station debout (calé : compare-recul.mjs)
for v, cad, duty, cc in BR:
    td, to, mi = lin(v, [(v0, pied100[0]), (2.7, -65)]), lin(v, [(v0, pied100[-1]), (2.7, -29)]), lin(v, [(v0, pied100.max()), (2.7, -2)])
    k = int(np.argmax(pied100)); x = pied100.copy()
    x[:k + 1] = td + (pied100[:k + 1] - pied100[0]) * (mi - td) / (pied100[k] - pied100[0])      # pose → le point le plus à plat
    x[k:] = mi + (pied100[k:] - pied100[k]) * (to - mi) / (pied100[-1] - pied100[k])           # → décollage
    pic = lin(v, [(v0, gen100.max()), (5.1, 85)]); amp = lin(v, [(v0, 18.0), (5.1, 41.8)]) / 18.0
    V.append(v); CAD.append(cad); DUTY.append(duty); PIED.append(r1(x)); META.append([0.0] * 21)
    HANCHE.append(r1(BASSIN_BR + ressort(duty) * cc / JAMBE_CAVAGNA, 4))
    CUI.append(r1(cui100 + (amp - 1) * (cui100 - chord(cui100)))); GEN.append(r1(gen100 * pic / gen100.max())); CHE.append(r1(che100)); VSOL.append(VSOL[-1])   # la cuisse : l'excursion au-delà de la corde décollage → pose (les bouts sont recalés sur l'appui réel)

bloc = ("export const RECUL_REF = {\n  v: %s,\n  cadence: %s,\n  duty: %s,\n  vsol: %s,\n  pied: %s,\n  hanche: %s,\n  metatarse: %s,\n  cuisse: %s,\n  genou: %s,\n  cheville: %s,\n};\n"
        % tuple(json.dumps(x).replace(',', ', ').replace(',  ', ', ') for x in (V, CAD, DUTY, VSOL, PIED, HANCHE, META, CUI, GEN, CHE)))
src = re.sub(r"export const RECUL_REF = \{.*?\n\};\n", "", src, flags=re.S)
src = src.replace("\n/** La cuisse et le genou de référence", "\n" + bloc + "\n/** La cuisse et le genou de référence", 1)
open(p, 'w').write(src)
print('RECUL_REF v', V); print('cadence', CAD); print('duty', DUTY); print('vsol', VSOL)
for i, v in enumerate(V): print(f"  {v}: pied {PIED[i][0]} → {max(PIED[i]) if v < 1.5 else PIED[i][len(PIED[i])//2]} → {PIED[i][-1]} | genou vol max {max(GEN[i])} | cuisse {CUI[i][0]} → max {max(CUI[i])} → {CUI[i][-1]} | bassin {min(HANCHE[i])}…{max(HANCHE[i])}")
