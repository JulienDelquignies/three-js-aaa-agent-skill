# LA MARCHE MESURÉE (marche-wbds.json : WBDS, 24 jeunes adultes, marche-mesure.py) → engine/foulee-rbds.js : MARCHE_VOL (le vol : cuisse,
# genou, cheville — 21 points de w) et les nœuds de marche d'APPUI_REF (pied, hanche sur le demi-cycle, métatarse, facteur d'appui) aux
# vitesses mesurées 0,59 / 0,90 / 1,21 / 1,51 / 1,78 m/s. Les facteurs d'appui de la course deviennent ceux des GROUPES : RBDS à la force
# (appui.py : 0,338 / 0,299 / 0,275) et la table de Dorn (9 sprinteurs : 0,276 / 0,254 / 0,257).
import json, re, sys, numpy as np
W = json.load(open(sys.argv[1])); p = sys.argv[2]; s = open(p).read()
ks = sorted(W, key=float); V = [W[k]['v'] for k in ks]
r1 = lambda a, d=1: np.round(a, d).tolist()
vol = "export const MARCHE_VOL = {\n  v: %s,\n  cuisse: %s,\n  genou: %s,\n  cheville: %s,\n};\n" % (json.dumps(V), json.dumps([r1(W[k]['volCuisse']) for k in ks]), json.dumps([r1(W[k]['volGenou']) for k in ks]), json.dumps([r1(W[k]['volCheville']) for k in ks]))
s = re.sub(r"export const MARCHE_VOL = \{.*?\n\};\n", "", s, flags=re.S)
s = s.replace("\nexport const RBDS_VOL = {", "\n" + vol + "export const RBDS_VOL = {", 1)
# APPUI_REF : préfixer les nœuds de marche (si pas déjà là) et poser les facteurs d'appui des groupes pour la course
m = re.search(r"export const APPUI_REF = \{\n  v: (\[.*?\]),\n  duty: (\[.*?\]),\n  pied: (\[.*?\]),\n  hanche: (\[.*?\]),\n  metatarse: (\[.*?\]),\n", s, flags=re.S)
v0, d0, p0, h0, m0 = [json.loads(x) for x in m.groups()]
keep = [i for i, x in enumerate(v0) if x >= 2.5]
v1 = V + [v0[i] for i in keep]; d1 = [round(W[k]['duty'], 3) for k in ks] + [0.338, 0.299, 0.275, 0.276, 0.254, 0.257]
hal = lambda c: [(c[i] + c[(i + 50) % 100]) / 2 for i in range(51)]
p1 = [r1(W[k]['piedAppui']) for k in ks] + [p0[i] for i in keep]; h1 = [r1(hal(W[k]['hancheCycle']), 4) for k in ks] + [h0[i] for i in keep]
m1 = [r1(np.maximum(0, W[k]['mtAppui']), 4) for k in ks] + [m0[i] for i in keep]
assert len(d1) == len(v1), (len(d1), len(v1))
new = "export const APPUI_REF = {\n  v: %s,\n  duty: %s,\n  pied: %s,\n  hanche: %s,\n  metatarse: %s,\n" % (json.dumps(v1), json.dumps(d1), json.dumps(p1).replace(',', ', ').replace(',  ', ', '), json.dumps(h1).replace(',', ', ').replace(',  ', ', '), json.dumps(m1).replace(',', ', ').replace(',  ', ', '))
s = s[:m.start()] + new + s[m.end():]
open(p, 'w').write(s); print('APPUI_REF v', v1); print('duty', d1)
