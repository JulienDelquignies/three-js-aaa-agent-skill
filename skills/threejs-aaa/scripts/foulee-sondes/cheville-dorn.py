# LA CHEVILLE EN VOL du sprinter mesuré (Dorn 2012, JA1) : angle du pied (talon → MT1) MOINS angle de la jambe (genou → cheville), sagittaux,
# chacun rapporté à la station debout (0 = pied à plat, jambe verticale) ; + = pointe relevée (flexion dorsale). Phase de vol normalisée
# (w = 0 au décollage, 1 à la pose), 21 points, moyenne des cycles — 3,53 / 5,19 / 6,97 / 9,47 m/s. → engine/foulee-rbds.js (CHEVILLE_VOL).
import numpy as np, json, re, sys
src = open('sprint-dorn.py').read(); src = src[:src.index('res = {}')]; g = {}; exec(src, g)
load, centres, st, ang = g['load'], g['centres'], g['st'], g['ang']; R = 250.0
f0 = np.mean([np.degrees(np.arctan2(st(s + 'P1MT')[2] - st(s + 'HEEL')[2], abs(st(s + 'P1MT')[1] - st(s + 'HEEL')[1]))) for s in 'LR'])
V, C_ = [], []
for name, f in (('3.53', 'Run35ms/JA1Gait21.c3d'), ('5.19', 'Run5ms/JA1Gait27.c3d'), ('6.97', 'Run7ms/JA1Gait33.c3d'), ('9.47', 'Run9ms/JA1Gait35.c3d')):
    lab, P, Vv, evs, t0 = load(f); sac = P[:, lab.index('SACR')]; fwd = 1 if sac[-1, 1] > sac[0, 1] else -1
    cur = []
    for side, S_ in (('L', 'Left'), ('R', 'Right')):
        C = centres(lab, P, Vv, side); v = C['P1MT'] - C['HEEL']; foot = np.degrees(np.arctan2(v[:, 2], v[:, 1] * fwd)) - f0
        shank = ang(C['ankle'] - C['knee'], fwd); ank = foot - shank
        fsx = [t for t, c, l in evs if c == S_ and l == 'Foot Strike']; fox = [t for t, c, l in evs if c == S_ and l == 'Foot Off']
        for a, b in zip(fsx, fsx[1:]):
            o = [x for x in fox if a < x < b]; io, ib = (int(round((o[0] - t0) * R)) if o else -1), int(round((b - t0) * R))
            if io < 0 or ib >= len(P): continue
            cur.append(np.interp(io + np.linspace(0, 1, 21) * (ib - io), np.arange(len(P)), ank))
    V.append(float(name)); C_.append(np.mean(cur, 0).round(1).tolist()); print(name, np.round(np.mean(cur, 0)[::4], 0))
block = "export const CHEVILLE_VOL = {\n  v: %s,\n  cheville: %s,\n};\n" % (json.dumps(V), json.dumps(C_).replace(',', ', ').replace(',  ', ', '))
if len(sys.argv) > 1:
    p = sys.argv[1]; s = open(p).read(); s = re.sub(r"export const CHEVILLE_VOL = \{.*?\n\};\n", "", s, flags=re.S)
    s = s.replace("\n/** La cuisse et le genou de référence", "\n" + block + "\n/** La cuisse et le genou de référence", 1); open(p, 'w').write(s)
