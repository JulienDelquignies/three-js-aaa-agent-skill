# L'APPUI MESURÉ du sprinter (Dorn 2012, JA1) au MÊME format et à la MÊME définition que appui-mesure.py (RBDS) : contacts par la force
# verticale des 8 plateformes (> 50 N, 1500 Hz — les décollages du laboratoire arrivent 5-11 ms plus tard), côté par l'évènement du labo le
# plus proche ; hanche (Harrington), cheville (malléoles reconstruites), MT1, pied (talon → MT1) − debout ; longueurs de jambe L.
import c3d, numpy as np, json
src = open('sprint-dorn.py').read(); src = src[:src.index('res = {}')]; g = {}; exec(src, g)
load, centres, st, hjc = g['load'], g['centres'], g['st'], g['hjc']; R = 250.0
ank0 = {s: (st(s + 'LMAL') + st(s + 'MMAL')) / 2 for s in 'LR'}; hip0 = {s: hjc(st('RASI'), st('LASI'), st('SACR'), s) for s in 'LR'}
Lj = {s: np.linalg.norm(hip0[s] - ank0[s]) for s in 'LR'}; mt0 = {s: st(s + 'P1MT') for s in 'LR'}; he0 = {s: st(s + 'HEEL') for s in 'LR'}
res = {}
for name, f in (('3.53', 'Run35ms/JA1Gait21.c3d'), ('5.19', 'Run5ms/JA1Gait27.c3d'), ('6.97', 'Run7ms/JA1Gait33.c3d'), ('9.47', 'Run9ms/JA1Gait35.c3d')):
    lab, P, V, evs, t0 = load(f); sac = P[:, lab.index('SACR')]; fwd = 1 if sac[-1, 1] > sac[0, 1] else -1
    r = c3d.Reader(open(f, 'rb')); al = [l.strip() for l in r.analog_labels]; A = np.concatenate([an for _, _, an in r.read_frames()], axis=1)
    fz = np.array([A[al.index(f'Fz{k}')] for k in range(1, 9)]); fz = fz - np.median(fz[:, :50], axis=1, keepdims=True); tot = np.abs(fz).sum(0)
    ta = t0 + np.arange(tot.size) / r.analog_rate; on = tot > 50; e = np.flatnonzero(np.diff(on.astype(int)))
    ups, downs = ta[e[on[e + 1]] + 1], ta[e[~on[e + 1]] + 1]
    labfs = [(tt, c) for tt, c, l in evs if l == 'Foot Strike']
    cont = []
    for u in ups:
        d = downs[downs > u]
        if not len(d): break
        near = min(labfs, key=lambda x: abs(x[0] - u))
        if abs(near[0] - u) < 0.02 and 0.08 < d[0] - u < 0.4: cont.append((near[1][0], u, d[0]))
    C = {s: centres(lab, P, V, s) for s in 'LR'}; tp = t0 + np.arange(len(P)) / R; I = lambda arr, tt: np.interp(tt, tp, arr)
    recs = []
    for s in 'LR':
        cs = [c for c in cont if c[0] == s]; c_ = C[s]; hip = c_['hip']; ank = c_['ankle']
        pied = np.degrees(np.arctan2(c_['P1MT'][:, 2] - c_['HEEL'][:, 2], (c_['P1MT'][:, 1] - c_['HEEL'][:, 1]) * fwd)) - np.degrees(np.arctan2(mt0[s][2] - he0[s][2], abs(mt0[s][1] - he0[s][1])))
        for (_, a0, a1), (_, b0, _) in zip(cs, cs[1:]):
            us = a0 + np.linspace(0, 1, 21) * (a1 - a0); uc = a0 + np.linspace(0, 1, 101) * (b0 - a0); L = Lj[s]
            recs.append(dict(duty=(a1 - a0) / (b0 - a0), T=b0 - a0, hanche_cycle=(I(hip[:, 2], uc) - hip0[s][2]) / L, hanche_appui=(I(hip[:, 2], us) - hip0[s][2]) / L,
                cheville_appui=(I(ank[:, 2], us) - ank0[s][2]) / L, mt1_appui=(I(c_['P1MT'][:, 2], us) - mt0[s][2]) / L, pied_appui=I(pied, us),
                chevilleHanche=[[float((I(ank[:, 1], x) - I(hip[:, 1], x)) * fwd / L), float((I(hip[:, 2], x) - I(ank[:, 2], x)) / L)] for x in (a0, a1)],
                genou_appui=I(g['ang'](c_['knee'] - hip, fwd) - g['ang'](ank - c_['knee'], fwd), us)))
    if not recs: continue
    m = lambda k: np.mean([x[k] for x in recs], 0)
    res[name] = {k: m(k).round(4).tolist() for k in ('hanche_cycle', 'hanche_appui', 'cheville_appui', 'mt1_appui', 'pied_appui', 'genou_appui')}
    res[name]['chevilleHanche'] = m('chevilleHanche').round(3).tolist(); res[name]['duty'] = float(m('duty')); res[name]['cycles'] = len(recs); res[name]['contact_s'] = float(np.mean([x['duty'] * x['T'] for x in recs]))
    q = res[name]; print(f"{name} m/s ({q['cycles']} appuis, contact {q['contact_s']*1000:.0f} ms, facteur {q['duty']:.3f}) : hanche pose/mi/décol {q['hanche_appui'][0]:.3f} {q['hanche_appui'][10]:.3f} {q['hanche_appui'][20]:.3f} L, max vol {max(q['hanche_cycle']):.3f} | cheville pose {q['cheville_appui'][0]:.3f} décol {q['cheville_appui'][20]:.3f} | MT1 décol {q['mt1_appui'][20]:.3f} | pied décol {q['pied_appui'][20]:.0f}° | cheville/hanche pose {q['chevilleHanche'][0]} décol {q['chevilleHanche'][1]} | genou pose {q['genou_appui'][0]:.0f} max {max(q['genou_appui']):.0f} décol {q['genou_appui'][20]:.0f} min {min(q['genou_appui']):.0f}")
json.dump(res, open('appui-dorn.json', 'w'))
