# LA MARCHE À RECULONS MESURÉE (Scherpereel, Molinaro, Inan, Shepherd & Young 2023, Scientific Data 10:924 — SMARTech, Georgia Tech,
# DOI 10.35090/gatech/70296, CC BY 4.0) : 12 adultes sur tapis instrumenté à deux bandes, `walk_backward` à 0,6 / 0,8 / 1,0 m/s et
# `normal_walk` à 0,6 / 1,2 m/s (la référence avant des MÊMES sujets), marqueurs à 200 Hz (mm, Y haut). Contacts par la FORCE VERTICALE
# de chaque bande (> 50 N). Les fenêtres de vitesse sont celles des données traitées (20 s, le nom du dossier donne la vitesse).
# Par classe : cadence, appui, vol (cuisse globale, genou, cheville), appui (pied talon → MT1, hauteur du talon et du MT1), bassin sur le
# cycle, pose / décollage (cheville / hanche), premier contact (MT1 ou talon), vitesse sol du MT1 à la pose.
# Usage (dans le dossier des données, arborescence `raw/ABxx/{MarkerData,CSV_Data}` + `scherp/ABxx/<tâche>_<n>_<vitesse>/`) :
#   python3 recul-mesure.py > recul-scherpereel.json
import numpy as np, glob, re, json, os, sys

def trc(f):
    L = open(f).read().splitlines(); names = L[3].split('\t')[2:]; names = [n for n in names if n.strip()]
    D = np.array([[float(x) if x.strip() else np.nan for x in ln.split('\t')[:2 + 3 * len(names)]] for ln in L[5:] if ln.strip()])
    return D[:, 1], {n: D[:, 2 + 3 * i:5 + 3 * i] for i, n in enumerate(names)}

def grf(f):
    import csv
    R = list(csv.reader(open(f))); h = R[0]; D = np.array([[float(x) if x not in ('', 'NaN') else np.nan for x in r] for r in R[1:]])
    return h, D

def hjc(ra, la, rp, lp, side):   # Harrington 2007 (mm) — x avant, y vers la gauche, z haut
    o = (ra + la) / 2; p = (rp + lp) / 2; y = la - ra; y /= np.linalg.norm(y); xa = o - p; x = xa - (xa @ y) * y; x /= np.linalg.norm(x); z = np.cross(x, y)
    PW = np.linalg.norm(la - ra); PD = np.linalg.norm(o - p)
    return o + (-0.24 * PD - 9.9) * x + (0.33 * PW + 7.3) * (1 if side == 'L' else -1) * y + (-0.30 * PW - 10.9) * z

def lisse(x, k):
    w = np.ones(k) / k; return np.convolve(np.pad(x, (k // 2, k // 2), mode='edge'), w, mode='valid')

acc = {}
for seg in sorted(glob.glob('scherp/AB*/*/')):
    m = re.search(r'scherp/(AB\d+)/((walk_backward|normal_walk)_(\d))_(\d)-(\d)/', seg)
    if not m: continue
    sid, tache, kind, num, a_, b_ = m.groups(); vnom = float(f'{a_}.{b_}'); recul = kind == 'walk_backward'
    trial = f'{kind}_{num}'
    ftrc = f'raw/{sid}/MarkerData/{trial}.trc'; fgrf = f'raw/{sid}/CSV_Data/{trial}/GroundFrame_GRFs.csv'
    stat = sorted(glob.glob(f'raw/{sid}/MarkerData/static_*.trc'), key=lambda s: int(re.search(r'static_(\d+)', s).group(1)))
    if not (os.path.exists(ftrc) and os.path.exists(fgrf) and stat): continue
    ang_ = glob.glob(seg + '*_angle.csv')[0]; tt = np.loadtxt(ang_, delimiter=',', skiprows=1, usecols=0); t0, t1 = tt[0], tt[-1]
    t, M = trc(ftrc)
    BESOIN = ('RASI', 'LASI', 'RPSI', 'LPSI', 'LKNE', 'LMKNE', 'RKNE', 'RMKNE', 'LANK', 'LMANK', 'RANK', 'RMANK', 'LCAL', 'RCAL', 'LMT1', 'RMT1')
    S = next((S_ for _, S_ in (trc(f) for f in stat) if all(n in S_ and np.isfinite(np.nanmedian(S_[n], 0)).all() for n in BESOIN)), None)   # le premier essai statique complet
    if S is None: print(sid, 'pas de statique complet', file=sys.stderr); continue
    if not all(n in M for n in BESOIN): print(sid, trial, 'marqueurs absents :', [n for n in BESOIN if n not in M], file=sys.stderr); continue
    gs = lambda n: np.nanmedian(S[n], 0)
    hg, G = grf(fgrf); tg = G[:, 0]
    win = (t >= t0) & (t <= t1); idx = np.where(win)[0]
    if len(idx) < 400: continue
    dt = np.median(np.diff(t))
    # l'avant du bassin (ASIS − PSIS), horizontal, moyen sur la fenêtre ; Y est le haut
    fw = np.nanmean((M['LASI'] + M['RASI'] - M['LPSI'] - M['RPSI'])[idx] / 2, 0); fw[1] = 0; fw /= np.linalg.norm(fw)
    sag = lambda P: np.stack([P @ fw, P[:, 1]], 1)                         # [avant, haut] en mm
    for side in 'LR':
        S_ = side; ra, la, rp, lp = (gs(n) for n in ('RASI', 'LASI', 'RPSI', 'LPSI'))
        hip0 = hjc(ra, la, rp, lp, side)                                   # Harrington bâtit son repère sur les marqueurs (labo direct : avant × gauche = haut)
        ank0 = (gs(side + 'ANK') + gs(side + 'MANK')) / 2; kn0 = (gs(side + 'KNE') + gs(side + 'MKNE')) / 2
        he0, mt0 = gs(side + 'CAL'), gs(side + 'MT1')
        L = np.linalg.norm(hip0 - kn0) + np.linalg.norm(kn0 - ank0)
        hip = np.array([hjc(M['RASI'][i], M['LASI'][i], M['RPSI'][i], M['LPSI'][i], side) for i in idx])
        kn = ((M[side + 'KNE'] + M[side + 'MKNE']) / 2)[idx]; an = ((M[side + 'ANK'] + M[side + 'MANK']) / 2)[idx]; he = M[side + 'CAL'][idx]; mt = M[side + 'MT1'][idx]
        if np.isnan(hip).any() or np.isnan(kn).any() or np.isnan(an).any() or np.isnan(he).any() or np.isnan(mt).any():
            ok = ~(np.isnan(hip).any(1) | np.isnan(kn).any(1) | np.isnan(an).any(1) | np.isnan(he).any(1) | np.isnan(mt).any(1))
            if ok.mean() < 0.9: continue
        H, K, A, E, T_ = sag(hip), sag(kn), sag(an), sag(he), sag(mt)
        angS = lambda d: np.degrees(np.arctan2(d[:, 0], -d[:, 1]))                # depuis la verticale basse, + = en avant
        th = angS(K - H); sh = angS(A - K); knee = th - sh
        f0 = np.degrees(np.arctan2(mt0[1] - he0[1], np.hypot(*(mt0 - he0)[[0, 2]])))
        pied = np.degrees(np.arctan2(T_[:, 1] - E[:, 1], T_[:, 0] - E[:, 0])) - f0; chev = pied - sh   # cheville = pied − angle de la jambe (convention de marche-mesure.py)
        # contacts : force verticale de la bande du côté (> 50 N), ramenée au temps des marqueurs
        col = [i for i, n in enumerate(hg) if re.match(('L' if side == 'L' else 'R') + r'.*Force.*Y', n) or re.match(('L' if side == 'L' else 'R') + r'.*F.*[Yy]$', n)]
        if not col: print('colonnes GRF ?', hg, file=sys.stderr); sys.exit(1)
        fz = np.interp(t[idx], tg, np.nan_to_num(np.abs(G[:, col[0]])))
        c = fz > 50; td = np.where(c[1:] & ~c[:-1])[0] + 1; to = np.where(~c[1:] & c[:-1])[0] + 1
        # la vitesse de la bande : le MT1 au milieu de l'appui (mm/s le long de l'avant)
        vmt = np.gradient(T_[:, 0], dt)
        for a, b in zip(td[:-1], td[1:]):
            o = to[(to > a) & (to < b)]
            if len(o) != 1: continue
            o = o[0]; Tc = (b - a) * dt
            if not (0.6 < Tc < 3.0): continue
            mi = slice(a + (o - a) // 3, a + 2 * (o - a) // 3); vbelt = float(np.median(vmt[mi])) / 1000   # m/s au labo, le long de l'avant du bassin
            I = lambda arr, s, e, n: np.interp(np.linspace(s, e, n), np.arange(len(arr)), arr)
            # la vitesse sol du MT1 et du talon à la pose : la vitesse au labo moins celle de la bande
            vpose = lambda P: float((np.gradient(P[:, 0], dt)[a] / 1000 - vbelt))
            key = ('recul' if recul else 'avant', vnom)
            acc.setdefault(key, []).append(dict(sid=sid, v=abs(vbelt), vbelt=vbelt, T=Tc, duty=(o - a) / (b - a),
                volCuisse=I(th, o, b, 21), volGenou=I(knee, o, b, 21), volCheville=I(chev, o, b, 21),
                piedAppui=I(pied, a, o, 21), talonAppui=(I(E[:, 1], a, o, 21) - he0[1]) / L, mtAppui=(I(T_[:, 1], a, o, 21) - mt0[1]) / L,
                hancheCycle=(I(H[:, 1], a, b, 101) - hip0[1]) / L, genouCycle=I(knee, a, b, 101), cuisseCycle=I(th, a, b, 101),
                pose=[(A[a, 0] - H[a, 0]) / L, (H[a, 1] - A[a, 1]) / L], decol=[(A[o, 0] - H[o, 0]) / L, (H[o, 1] - A[o, 1]) / L],
                mtPremier=bool((T_[a, 1] - mt0[1]) < (E[a, 1] - he0[1])), talonH_pose=float((E[a, 1] - he0[1]) / L), mtH_pose=float((T_[a, 1] - mt0[1]) / L),
                vsolMT=vpose(T_), vsolTalon=vpose(E), vsolCheville=vpose(A), L=L / 1000,
                dutyCin=float(np.mean(np.minimum(E[a:b, 1] - he0[1], T_[a:b, 1] - mt0[1]) < 10)),   # appui CINÉMATIQUE : talon ou MT1 à < 1 cm de sa hauteur debout
                gardeMT=float(np.min(T_[o + int(0.3 * (b - o)):o + int(0.7 * (b - o)) + 1, 1]) - mt0[1]), gardeTalon=float(np.min(E[o + int(0.3 * (b - o)):o + int(0.7 * (b - o)) + 1, 1]) - he0[1])))   # mm, milieu du vol
res = {}
for (sens, vn), cs in sorted(acc.items()):
    m = lambda k: np.mean([c[k] for c in cs], 0)
    r = {k: np.round(m(k), 4).tolist() for k in ('volCuisse', 'volGenou', 'volCheville', 'piedAppui', 'talonAppui', 'mtAppui', 'hancheCycle', 'genouCycle', 'cuisseCycle', 'pose', 'decol')}
    r.update(sens=sens, vnom=vn, v=round(float(m('v')), 3), f=round(float(np.mean([1 / c['T'] for c in cs])), 4), duty=round(float(m('duty')), 4), n=len(cs), sujets=len({c['sid'] for c in cs}),
             mtPremier=round(float(m('mtPremier')), 3), talonH_pose=round(float(m('talonH_pose')), 4), mtH_pose=round(float(m('mtH_pose')), 4),
             vsolMT=round(float(np.median([c['vsolMT'] for c in cs])), 3), vsolTalon=round(float(np.median([c['vsolTalon'] for c in cs])), 3), vsolCheville=round(float(np.median([c['vsolCheville'] for c in cs])), 3),
             dutyCin=round(float(m('dutyCin')), 4), gardeMT=[round(float(np.percentile([c['gardeMT'] for c in cs], q)), 1) for q in (25, 50)], gardeTalon=[round(float(np.percentile([c['gardeTalon'] for c in cs], q)), 1) for q in (25, 50)],
             L=round(float(m('L')), 4), sd={'f': round(float(np.std([1 / c['T'] for c in cs])), 4), 'duty': round(float(np.std([c['duty'] for c in cs])), 4)})
    res[f'{sens}-{vn}'] = r; hc = r['hancheCycle']; gc = r['genouCycle']; to = round(100 * r['duty'])
    print(f"{sens} {vn} m/s ({r['n']} cycles, {r['sujets']} sujets, v {r['v']}) : f {r['f']:.3f} Hz, appui {r['duty']:.3f} (cinématique {r['dutyCin']:.3f}) | genou pose {gc[0]:.0f} max appui {max(gc[:to]):.0f} décol {gc[to]:.0f} vol max {max(r['volGenou']):.0f} | cuisse vol {r['volCuisse'][0]:.0f} → {r['volCuisse'][-1]:.0f} (min {min(r['volCuisse']):.0f} max {max(r['volCuisse']):.0f}) | pied pose {r['piedAppui'][0]:.0f} décol {r['piedAppui'][20]:.0f} | MT1 d'abord {r['mtPremier']:.2f} | hanche min {min(hc):.3f} max {max(hc):.3f} | pose {np.round(r['pose'],3)} décol {np.round(r['decol'],3)} | vsol MT1 {r['vsolMT']} talon {r['vsolTalon']} cheville {r['vsolCheville']} | garde (p25, p50 mm) MT1 {r['gardeMT']} talon {r['gardeTalon']}", file=sys.stderr)
json.dump(res, sys.stdout)
