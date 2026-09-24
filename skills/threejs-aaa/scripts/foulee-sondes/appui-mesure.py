# L'APPUI MESURÉ (RBDS — Fukuchi 2017, 14 coureurs à 2,5 / 3,5 / 4,5 m/s, marqueurs 150 Hz + force verticale 300 Hz) : par appui (contact
# par la force > 50 N), sur l'appui normalisé (21 points, 0 = pose, 1 = décollage) et sur le cycle (101 points, pose → pose du même pied) :
# hauteur de la HANCHE (centre articulaire, Harrington 2007 : ASIS + PSIS) − debout, hauteur de la CHEVILLE (centre malléolaire reconstruit
# de l'essai statique par corps rigide sur la plaque de jambe) et du MT1 − debout, angle du PIED (talon bas → MT1) − debout, cheville par
# rapport à la hanche (avant, dessous) ; tout en longueurs de jambe L (hanche → cheville debout). Repère : X avant (le tapis), Y haut, mm.
import numpy as np, glob, re, os, json
def load(f):
    L = open(f).read().splitlines(); h = L[0].split('\t')
    d = np.array([[float(x) if x.strip() not in ('', 'NaN') else np.nan for x in (ln.split('\t') + [''] * len(h))[:len(h)]] for ln in L[1:] if ln.strip()])
    return h, d
def kabsch(A, B):
    ca, cb = A.mean(0), B.mean(0); H = (A - ca).T @ (B - cb); U, S, Vt = np.linalg.svd(H); d = np.sign(np.linalg.det(Vt.T @ U.T))
    Rm = Vt.T @ np.diag([1, 1, d]) @ U.T; return Rm, cb - ca @ Rm.T
def hjc(ra, la, rp, lp, side):   # repère bassin : x avant, y vers la gauche… ici Y haut : on construit z = x × y
    o = (ra + la) / 2; p = (rp + lp) / 2; y = la - ra; y /= np.linalg.norm(y); xa = o - p; x = xa - (xa @ y) * y; x /= np.linalg.norm(x); z = np.cross(x, y)
    PW = np.linalg.norm(la - ra); PD = np.linalg.norm(o - p)
    return o + (-0.24 * PD - 9.9) * x + (0.33 * PW + 7.3) * (1 if side == 'L' else -1) * y + (-0.30 * PW - 10.9) * z
SH = ['Shank.Top.Lateral', 'Shank.Top.Medial', 'Shank.Bottom.Lateral', 'Shank.Bottom.Medial']
out = {}
for fm in sorted(glob.glob('mk/RBDS*markers.txt')):
    sid, sp = re.search(r'(RBDS\d+)runT(\d\d)markers', fm).groups(); v = int(sp) / 10
    ff = fm.replace('markers', 'forces'); fs = f'mk/{sid}static.txt'
    if not (os.path.exists(ff) and os.path.exists(fs)): continue
    h, M = load(fm); hf, Fz = load(ff); hs, S = load(fs)
    g = lambda n: M[:, h.index(n + 'X'):h.index(n + 'X') + 3]; gs = lambda n: np.nanmean(S[:, hs.index(n + 'X'):hs.index(n + 'X') + 3], 0)
    t = M[:, 0]; fy = Fz[:, hf.index('Fy')]; tf = (Fz[:, 0] - 1) / 300.0; on = fy > 50
    e = np.flatnonzero(np.diff(on.astype(int))); ups, downs = e[on[e + 1]] + 1, e[~on[e + 1]] + 1
    st = []
    for u in ups:
        dn = downs[downs > u]
        if not len(dn): break
        t0, t1 = tf[u], tf[dn[0]]
        if not (0.1 < t1 - t0 < 0.5): continue
        tm = (t0 + t1) / 2; side = 'R' if np.interp(tm, t, g('R.MT1')[:, 1]) < np.interp(tm, t, g('L.MT1')[:, 1]) else 'L'
        st.append((side, t0, t1))
    for side in 'RL':
        # l'essai statique : centres et hauteurs debout
        A = np.array([gs(f'{side}.{m}') for m in SH]); ank0 = (gs(f'{side}.Ankle') + gs(f'{side}.Ankle.Medial')) / 2
        hip0 = hjc(gs('R.ASIS'), gs('L.ASIS'), gs('R.PSIS'), gs('L.PSIS'), side); Lj = np.linalg.norm(hip0 - ank0)
        mt0 = gs(f'{side}.MT1'); hb0 = gs(f'{side}.Heel.Bottom'); f0 = np.degrees(np.arctan2(mt0[1] - hb0[1], mt0[0] - hb0[0]))
        n = len(M); ank = np.full((n, 3), np.nan)
        for i in range(n):
            B = np.array([M[i, h.index(f'{side}.{m}X'):h.index(f'{side}.{m}X') + 3] for m in SH])
            if np.isnan(B).any(): continue
            Rm, tt = kabsch(A, B); ank[i] = ank0 @ Rm.T + tt
        hip = np.array([hjc(g('R.ASIS')[i], g('L.ASIS')[i], g('R.PSIS')[i], g('L.PSIS')[i], side) for i in range(n)])
        mt = g(f'{side}.MT1'); hb = g(f'{side}.Heel.Bottom'); pied = np.degrees(np.arctan2(mt[:, 1] - hb[:, 1], mt[:, 0] - hb[:, 0])) - f0
        ss = [x for x in st if x[0] == side]
        for (_, a0, a1), (_, b0, _) in zip(ss, ss[1:]):
            if b0 - a0 > 1.2: continue
            us = a0 + np.linspace(0, 1, 21) * (a1 - a0); uc = a0 + np.linspace(0, 1, 101) * (b0 - a0)
            I = lambda arr, tt: np.interp(tt, t, arr)
            avance = ((I(ank[:, 0], us) + v * 1000 * us) - (I(ank[:, 0], a0) + v * 1000 * a0)) / Lj   # repère du tapis : un point posé y est fixe
            rec = dict(duty=(a1 - a0) / (b0 - a0), T=b0 - a0, avance_appui=avance.tolist(), trajet=v * (a1 - a0) / (Lj / 1000),
                hanche_cycle=((I(hip[:, 1], uc) - hip0[1]) / Lj).tolist(), hanche_appui=((I(hip[:, 1], us) - hip0[1]) / Lj).tolist(),
                cheville_appui=((I(ank[:, 1], us) - ank0[1]) / Lj).tolist(), mt1_appui=((I(mt[:, 1], us) - mt0[1]) / Lj).tolist(), pied_appui=I(pied, us).tolist(),
                chevilleHanche=[[float((I(ank[:, 0], x) - I(hip[:, 0], x)) / Lj), float((I(hip[:, 1], x) - I(ank[:, 1], x)) / Lj)] for x in (a0, a1)], L=Lj / 1000)
            if any(np.isnan(np.array(rec[k])).any() for k in ('hanche_cycle', 'cheville_appui')): continue
            out.setdefault(str(v), {}).setdefault(sid, []).append(rec)
res = {}
for v, runners in sorted(out.items()):
    per = {k: [] for k in ('hanche_cycle', 'hanche_appui', 'cheville_appui', 'mt1_appui', 'pied_appui', 'avance_appui')}; geo = []; duty = []; traj = []
    for sid, cs in runners.items():
        Tm = np.median([c['T'] for c in cs]); cs = [c for c in cs if abs(c['T'] - Tm) < 0.12 * Tm and 0.15 < c['duty'] < 0.5]   # cycles appariés (un appui manqué double T, un côté inversé le divise)
        if not cs: continue
        for k in per: per[k].append(np.nanmean([c[k] for c in cs], 0))
        geo.append(np.nanmedian([c['chevilleHanche'] for c in cs], 0)); duty.append(np.mean([c['duty'] for c in cs])); traj.append(np.mean([c['trajet'] for c in cs]))
    res[v] = {k: np.nanmean(per[k], 0).round(4).tolist() for k in per}; res[v]['chevilleHanche'] = np.nanmedian(geo, 0).round(3).tolist(); res[v]['trajet'] = float(np.mean(traj)); res[v]['duty'] = float(np.mean(duty)); res[v]['coureurs'] = len(runners)
    r = res[v]; print(f"{v} m/s ({r['coureurs']} coureurs) : hanche pose/mi/décol {r['hanche_appui'][0]:.3f} {r['hanche_appui'][10]:.3f} {r['hanche_appui'][20]:.3f} L, max vol {max(r['hanche_cycle']):.3f} | cheville pose {r['cheville_appui'][0]:.3f} décol {r['cheville_appui'][20]:.3f} L | MT1 décol {r['mt1_appui'][20]:.3f} | pied décol {r['pied_appui'][20]:.0f}° | cheville/hanche pose {r['chevilleHanche'][0]} décol {r['chevilleHanche'][1]} | avance cheville {r['avance_appui'][20]:.3f} L, corps {r['trajet']:.3f} L | pied pose {r['pied_appui'][0]:.0f}° ({r['pied_appui'][2]:.0f}, {r['pied_appui'][5]:.0f}, {r['pied_appui'][10]:.0f}, {r['pied_appui'][15]:.0f})")
talons = []
for fs in sorted(glob.glob('mk/RBDS*static.txt')):
    hs, S = load(fs); gs = lambda n: np.nanmean(S[:, hs.index(n + 'X'):hs.index(n + 'X') + 3], 0)
    for side in 'RL':
        a = (gs(f'{side}.Ankle') + gs(f'{side}.Ankle.Medial')) / 2; m = gs(f'{side}.MT1'); hb = gs(f'{side}.Heel.Bottom'); Lf = np.hypot(m[0] - a[0], m[1] - a[1])
        talons.append(((a[0] - hb[0]) / Lf, (a[1] - hb[1]) / Lf, (a[1] - m[1]) / Lf))
tl = np.nanmedian(talons, 0); res['talon'] = dict(derriere=float(tl[0]), dessous=float(tl[1]), chevilleSurMT1=float(tl[2]), n=len(talons))
print('talon (debout, en longueurs cheville→MT1) : %.2f derrière la cheville, %.2f dessous ; cheville %.2f au-dessus du MT1' % tuple(tl))
json.dump(res, open('appui-rbds.json', 'w'))
