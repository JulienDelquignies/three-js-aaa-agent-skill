# LA MARCHE MESURÉE (WBDS — Fukuchi, Fukuchi & Duarte 2018, PeerJ 6:e4640, figshare 5722711, CC BY 4.0 ; le labo de RBDS) : 24 jeunes
# adultes sur tapis, 8 vitesses chacun (0,4 → 2,2 m/s), marqueurs anatomiques à 150 Hz (X avant, Y haut, mm). Évènements par la méthode
# cinématique de Zeni (2008 : la pose = talon le plus en avant du bassin, le décollage = MT1 le plus en arrière). Par classe de vitesse :
# cadence, appui, vol réaligné (cuisse globale, genou, cheville), appui (pied, cheville, MT1, hanche), pose / décollage, avance propre.
import numpy as np, glob, re, json, csv
def load(f):
    L = open(f).read().splitlines(); h = L[0].split('\t')
    return h, np.array([[float(x) if x.strip() not in ('', 'NaN') else np.nan for x in (ln.split('\t') + [''] * len(h))[:len(h)]] for ln in L[1:] if ln.strip()])
def hjc(ra, la, rp, lp, side):   # Harrington 2007 ; repère : x avant, y haut, z latéral
    o = (ra + la) / 2; p = (rp + lp) / 2; y = la - ra; y /= np.linalg.norm(y); xa = o - p; x = xa - (xa @ y) * y; x /= np.linalg.norm(x); z = np.cross(x, y)
    PW = np.linalg.norm(la - ra); PD = np.linalg.norm(o - p)
    return o + (-0.24 * PD - 9.9) * x + (0.33 * PW + 7.3) * (1 if side == 'L' else -1) * y + (-0.30 * PW - 10.9) * z
ang = lambda v: np.degrees(np.arctan2(v[..., 0], -v[..., 1]))          # sagittal depuis la verticale basse, + = en avant (x avant, y haut)
info = {r['FileName']: r for r in csv.DictReader(open('WBDSinfo.csv'))}
young = set(open('jeunes.txt').read().split())
BINS = [0.6, 0.9, 1.2, 1.5, 1.8]
acc = {b: [] for b in BINS}
for f in sorted(glob.glob('51subjs/WBDS*walkT*mkr.txt')):
    sid = re.search(r'(WBDS\d+)', f).group(1)
    if sid not in young: continue
    v = float(info[f.split('/')[-1]]['GaitSpeed(m/s)']); b = min(BINS, key=lambda x: abs(x - v))
    if abs(b - v) > 0.16: continue
    h, M = load(f); hs, S = load(f'51subjs/{sid}static1.txt')
    g = lambda n: M[:, h.index(n + 'X'):h.index(n + 'X') + 3]; gs = lambda n: np.nanmean(S[:, hs.index(n + 'X'):hs.index(n + 'X') + 3], 0)
    t = M[:, 0]; dt = np.median(np.diff(t)); pel = (g('R.ASIS') + g('L.ASIS') + g('R.PSIS') + g('L.PSIS')) / 4
    for side in 'RL':
        hip0 = hjc(gs('R.ASIS'), gs('L.ASIS'), gs('R.PSIS'), gs('L.PSIS'), side); ank0 = (gs(f'{side}.Ankle') + gs(f'{side}.Ankle.Medial')) / 2
        L = np.hypot(*(hip0 - ank0)[:2]); mt0 = gs(f'{side}.MT1'); he0 = gs(f'{side}.Heel'); f0 = np.degrees(np.arctan2(mt0[1] - he0[1], mt0[0] - he0[0]))
        hip = np.array([hjc(g('R.ASIS')[i], g('L.ASIS')[i], g('R.PSIS')[i], g('L.PSIS')[i], side) for i in range(len(M))])
        kn, an, he, mt = g(f'{side}.Knee'), g(f'{side}.Ankle'), g(f'{side}.Heel'), g(f'{side}.MT1')
        if np.isnan(hip).any() or np.isnan(kn).any() or np.isnan(an).any(): continue
        th = ang(kn - hip); sh = ang(an - kn); knee = th - sh; pied = np.degrees(np.arctan2(mt[:, 1] - he[:, 1], mt[:, 0] - he[:, 0])) - f0; chev = pied - sh
        # Zeni : extrêmes du talon / du MT1 par rapport au bassin
        rh = he[:, 0] - pel[:, 0]; rt = mt[:, 0] - pel[:, 0]; w = int(0.35 / dt)
        HS = [i for i in range(w, len(M) - w) if rh[i] == rh[i - w:i + w + 1].max()]; TO = [i for i in range(w, len(M) - w) if rt[i] == rt[i - w:i + w + 1].min()]
        for a, c in zip(HS, HS[1:]):
            o = [x for x in TO if a < x < c]
            if len(o) != 1: continue
            o = o[0]; T = (c - a) * dt
            if not (0.6 < T < 2.5): continue
            I = lambda arr, idx: np.interp(idx, np.arange(len(M)), arr)
            us = a + np.linspace(0, 1, 21) * (o - a); uw = o + np.linspace(0, 1, 21) * (c - o); uc = a + np.linspace(0, 1, 101) * (c - a)
            acc[b].append(dict(v=v, T=T, duty=(o - a) / (c - a),
                volCuisse=I(th, uw), volGenou=I(knee, uw), volCheville=I(chev, uw),
                piedAppui=I(pied, us), chevAppui=(I(an[:, 1], us) - ank0[1]) / L, mtAppui=(I(mt[:, 1], us) - mt0[1]) / L,
                hancheCycle=(I(hip[:, 1], uc) - hip0[1]) / L, genouCycle=I(knee, uc),
                pose=[(an[a, 0] - hip[a, 0]) / L, (hip[a, 1] - an[a, 1]) / L], decol=[(an[o, 0] - hip[o, 0]) / L, (hip[o, 1] - an[o, 1]) / L],
                avance=((an[o, 0] + v * 1000 * t[o]) - (an[a, 0] + v * 1000 * t[a])) / L, trajet=v * 1000 * (o - a) * dt / L))
res = {}
for b in BINS:
    cs = acc[b]
    if not cs: continue
    m = lambda k: np.mean([c[k] for c in cs], 0)
    r = {k: np.round(m(k), 4).tolist() for k in ('volCuisse', 'volGenou', 'volCheville', 'piedAppui', 'chevAppui', 'mtAppui', 'hancheCycle', 'genouCycle', 'pose', 'decol')}
    r.update(v=round(float(m('v')), 3), f=round(float(np.mean([1 / c['T'] for c in cs])), 4), duty=round(float(m('duty')), 4), avance=round(float(m('avance')), 4), trajet=round(float(m('trajet')), 4), n=len(cs))
    res[str(b)] = r; hc = r['hancheCycle']; gc = r['genouCycle']; to = round(100 * r['duty'])
    print(f"{b} m/s (moy {r['v']}, {r['n']} cycles) : f {r['f']:.3f} Hz, appui {r['duty']:.3f} | genou pose {gc[0]:.0f} max appui {max(gc[:to]):.0f} décol {gc[to]:.0f} vol max {max(r['volGenou']):.0f} | cuisse vol {min(r['volCuisse']):.0f}…{max(r['volCuisse']):.0f} | pied pose {r['piedAppui'][0]:.0f} décol {r['piedAppui'][20]:.0f} | hanche pose {hc[0]:.3f} mi {hc[to//2]:.3f} décol {hc[to]:.3f} max {max(hc):.3f} min {min(hc):.3f} | pose {np.round(r['pose'],3)} décol {np.round(r['decol'],3)} | avance {r['avance']:.3f} L")
json.dump(res, open('marche-wbds.json', 'w'))
