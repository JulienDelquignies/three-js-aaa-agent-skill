# LA GARDE DU MÉTATARSE EN VOL chez les coureurs RBDS (14 coureurs × 2,5 / 3,5 / 4,5 m/s) : MT1 (la tête du 1er métatarse — l'os ToeBase
# du moteur) au-dessus de sa hauteur debout (essai statique), pendant le vol (décollage → pose du même pied, contacts par la force
# verticale > 50 N), minimum sur w ∈ [0,3 ; 0,7] — la fenêtre du contrat « le vol rase la pelouse » (checkGaitGen).
import numpy as np, glob, re, os
def load(f):
    L = open(f).read().splitlines(); h = L[0].split('\t')
    d = np.array([[float(x) if x.strip() not in ('', 'NaN') else np.nan for x in (ln.split('\t') + [''] * len(h))[:len(h)]] for ln in L[1:] if ln.strip()])
    return h, d
res = {}
for fm in sorted(glob.glob('mk/RBDS*markers.txt')):
    sid, sp = re.search(r'(RBDS\d+)runT(\d\d)markers', fm).groups(); v = int(sp) / 10
    ff = fm.replace('markers', 'forces'); fs = f'mk/{sid}static.txt'
    if not (os.path.exists(ff) and os.path.exists(fs)): continue
    h, M = load(fm); hf, Fz = load(ff); hs, S = load(fs)
    c = lambda n: M[:, h.index(n)] / 1000.0; t = M[:, 0]
    fy = Fz[:, hf.index('Fy')]; tf = (Fz[:, 0] - 1) / 300.0; on = fy > 50
    e = np.flatnonzero(np.diff(on.astype(int))); ups, downs = e[on[e + 1]] + 1, e[~on[e + 1]] + 1
    st = []
    for u in ups:
        dn = downs[downs > u]
        if not len(dn): break
        t0, t1 = tf[u], tf[dn[0]]
        if not (0.1 < t1 - t0 < 0.5): continue
        tm = (t0 + t1) / 2; side = 'R' if np.interp(tm, t, c('R.MT1Y')) < np.interp(tm, t, c('L.MT1Y')) else 'L'
        st.append((side, t0, t1))
    for side in 'RL':
        mt0 = np.nanmean(S[:, hs.index(f'{side}.MT1Y')]) / 1000.0
        ss = [x for x in st if x[0] == side]
        for (_, a0, a1), (_, b0, b1) in zip(ss, ss[1:]):
            if b0 - a1 > 0.6: continue
            w = np.linspace(0.3, 0.7, 41); tt = a1 + w * (b0 - a1)
            z = np.interp(tt, t, c(f'{side}.MT1Y')) - mt0
            res.setdefault(v, {}).setdefault(sid, []).append(z.min())
for v in sorted(res):
    per = [np.nanmedian(x) for x in res[v].values()]
    allv = np.concatenate([np.array(x) for x in res[v].values()]); allv = allv[np.isfinite(allv)]
    print(f"{v} m/s : {len(res[v])} coureurs, {len(allv)} vols — garde du MT1 sur w∈[0,3 ; 0,7] : médiane {100*np.median(allv):.1f} cm, p10 {100*np.percentile(allv,10):.1f}, p25 {100*np.percentile(allv,25):.1f}, min coureur (médiane) {100*np.nanmin(per):.1f} cm, par coureur {sorted(round(100*p,1) for p in per)}")
