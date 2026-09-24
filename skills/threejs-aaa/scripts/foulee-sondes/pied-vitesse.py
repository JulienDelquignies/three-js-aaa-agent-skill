# Le pied au contact et au décollage (repère du TAPIS : x + v·t) — vitesse horizontale du talon et de MT1 à la pose (force > 50 N) et
# au décollage ; temps pour que MT1 monte de 1,5 cm après le décollage. RBDS, 14 coureurs × 3 vitesses.
import numpy as np, glob, re
exec(open('appui.py').read().split('import sys')[0])
res = {}
for fm in sorted(glob.glob('mk/RBDS*markers.txt')):
    sid, sp = re.search(r'RBDS(\d+)runT(\d\d)markers', fm).groups(); v = int(sp) / 10
    h, M = load(fm); hf, F = load(fm.replace('markers', 'forces'))
    c = lambda n: M[:, h.index(n)] / 1000.0; t = M[:, 0]
    fy = F[:, hf.index('Fy')]; tf = (F[:, 0] - 1) / 300.0; on = fy > 50
    e = np.flatnonzero(np.diff(on.astype(int))); ups, downs = e[on[e + 1]] + 1, e[~on[e + 1]] + 1
    for u in ups:
        dn = downs[downs > u]
        if not len(dn): break
        t0, t1 = tf[u], tf[dn[0]]
        if not (0.1 < t1 - t0 < 0.5): continue
        tm = (t0 + t1) / 2; s = 'R' if np.interp(tm, t, c('R.MT1Y')) < np.interp(tm, t, c('L.MT1Y')) else 'L'
        vb = lambda n, tt: (np.interp(tt + 0.004, t, c(n)) - np.interp(tt - 0.004, t, c(n))) / 0.008 + v   # vitesse au repère du tapis
        r = res.setdefault(v, {k: [] for k in ('talonPose', 'mt1Pose', 'talonDecol', 'mt1Decol', 'leve15')})
        r['talonPose'].append(vb(f'{s}.Heel.TopX', t0)); r['mt1Pose'].append(vb(f'{s}.MT1X', t0))
        r['talonDecol'].append(vb(f'{s}.Heel.TopX', t1)); r['mt1Decol'].append(vb(f'{s}.MT1X', t1))
        y0 = np.interp(t1, t, c(f'{s}.MT1Y')); m = (t > t1) & (t < t1 + 0.15); yy, tt = c(f'{s}.MT1Y')[m], t[m]
        k = np.argmax(yy > y0 + 0.015) if (yy > y0 + 0.015).any() else None
        if k is not None: r['leve15'].append(tt[k] - t1)
for v in sorted(res):
    r = {k: np.array(x) for k, x in res[v].items()}; md = lambda k: np.nanmedian(r[k]); p90 = lambda k: np.nanpercentile(r[k], 90)
    print(f"{v} m/s : pose — talon {md('talonPose'):+.2f} m/s (p90 {p90('talonPose'):+.2f}), MT1 {md('mt1Pose'):+.2f} | décollage — talon {md('talonDecol'):+.2f}, MT1 {md('mt1Decol'):+.2f} (p90 {p90('mt1Decol'):+.2f}) | MT1 +1,5 cm en {1000*md('leve15'):.0f} ms (p90 {1000*p90('leve15'):.0f})")
