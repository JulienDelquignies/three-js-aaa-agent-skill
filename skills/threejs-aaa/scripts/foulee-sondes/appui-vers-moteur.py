# L'APPUI MESURÉ → engine/foulee-rbds.js (APPUI_REF) : RBDS (appui-mesure.py : 2,5 / 3,5 / 4,5 m/s, 14 coureurs) puis le sprinter de Dorn
# (appui-dorn.py : 5,19 / 6,97 / 9,47 m/s, contacts aux plateformes). Par vitesse : l'inclinaison du PIED sur l'appui (21 points, 0 = pose,
# 1 = décollage ; degrés, + = pointe relevée), la hauteur de la HANCHE sur le demi-cycle (51 points, 0 = pose d'un pied, 0,5 = pose de
# l'autre ; les deux pieds moyennés ; en longueurs de jambe L, 0 = debout), la levée du MÉTATARSE sur l'appui (MT1 − debout, ≥ 0, en L : le
# roulé sur les orteils du sprinter au décollage) et le facteur d'appui mesuré (le recalage temporel) ; le TALON
# (debout, RBDS 28 pieds) : derrière la cheville / sous la cheville = 0,57 / 0,49.
import json, re, sys, numpy as np
R = json.load(open(sys.argv[1])); D = json.load(open(sys.argv[2])); p = sys.argv[3]
V, pied, hanche, duty, mt = [], [], [], [], []
for src, keys in ((R, ['2.5', '3.5', '4.5']), (D, ['5.19', '6.97', '9.47'])):
    for k in keys:
        c = np.array(src[k]['hanche_cycle']); h = [(c[i] + c[(i + 50) % 100]) / 2 for i in range(51)]
        V.append(float(k)); pied.append(np.round(src[k]['pied_appui'], 1).tolist()); hanche.append(np.round(h, 4).tolist()); duty.append(round(src[k]['duty'], 3)); mt.append(np.round(np.maximum(0, src[k]['mt1_appui']), 4).tolist())
t = R['talon']
block = "export const APPUI_REF = {\n  v: %s,\n  duty: %s,\n  pied: %s,\n  hanche: %s,\n  metatarse: %s,\n  talon: { derriere: %.2f, dessous: %.2f, roule: 0.54 },\n};\n" % (json.dumps(V), json.dumps(duty), json.dumps(pied).replace(',', ', ').replace(',  ', ', '), json.dumps(hanche).replace(',', ', ').replace(',  ', ', '), json.dumps(mt).replace(',', ', ').replace(',  ', ', '), t['derriere'], t['dessous'])
s = open(p).read(); s = re.sub(r"export const APPUI_REF = \{.*?\n\};\n", "", s, flags=re.S)
s = s.replace("\n/** La cuisse et le genou de référence", "\n" + block + "\n/** La cuisse et le genou de référence", 1); open(p, 'w').write(s)
for v, d, pp, hh in zip(V, duty, pied, hanche): print(v, 'appui', d, '| pied', pp[0], pp[5], pp[10], pp[15], pp[20], '| hanche pose', hh[0], 'min', min(hh), 'max', max(hh))
