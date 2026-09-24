# LA GÉOMÉTRIE DE L'APPUI chez les coureurs (RBDS, 14 × 3 vitesses) : contacts par la force verticale (> 50 N, 300 Hz), pied par le
# centre de pression ; à la pose : talon (Heel.Top) devant le centre du bassin ; au décollage : MT1 derrière ; le corps parcourt v·t_c ;
# le pied au repère du TAPIS (x + v·t) : de combien avancent talon et MT1 pendant l'appui. Hauteur du bassin (pose / mi-appui /
# décollage) par rapport à la station debout (essai statique).
import numpy as np, glob, re, os
def load(f):
    L = open(f).read().splitlines(); h = L[0].split('\t')
    d = np.array([[float(x) if x.strip() not in ('', 'NaN') else np.nan for x in (ln.split('\t') + [''] * len(h))[:len(h)]] for ln in L[1:] if ln.strip()])
    return h, d
import sys
SEUIL = float(sys.argv[1]) if len(sys.argv) > 1 else 50
res = {}
for fm in sorted(glob.glob('mk/RBDS*markers.txt')):
    sid, sp = re.search(r'(RBDS\d+)runT(\d\d)markers', fm).groups(); v = int(sp) / 10
    ff = fm.replace('markers', 'forces')
    if not os.path.exists(ff): continue
    h, M = load(fm); hf, Fz = load(ff)
    c = lambda n: M[:, h.index(n)] / 1000.0
    t = M[:, 0]; pel = (c('R.ASISX') + c('L.ASISX') + c('R.PSISX') + c('L.PSISX')) / 4; pely = (c('R.ASISY') + c('L.ASISY') + c('R.PSISY') + c('L.PSISY')) / 4
    fy = Fz[:, hf.index('Fy')]; copz = Fz[:, hf.index('COPz')] / 1000.0; tf = (Fz[:, 0] - 1) / 300.0
    on = fy > SEUIL
    edges = np.flatnonzero(np.diff(on.astype(int)))
    ups, downs = edges[on[edges + 1]] + 1, edges[~on[edges + 1]] + 1
    at = lambda arr, tt: np.interp(tt, t, arr)
    for u in ups:
        dn = downs[downs > u]
        if not len(dn): break
        d0 = dn[0]; t0, t1 = tf[u], tf[d0]
        if t1 - t0 < 0.1 or t1 - t0 > 0.5: continue
        tm = (t0 + t1) / 2
        side = 'R' if at(c('R.MT1Y'), tm) < at(c('L.MT1Y'), tm) else 'L'          # le pied au sol est le plus BAS (la largeur du CoP ne départage pas)
        H, MT = c(f'{side}.Heel.TopX'), c(f'{side}.MT1X')
        r = res.setdefault(v, {k: [] for k in ('tc', 'talon_devant', 'mt1_derriere', 'talon_tapis', 'mt1_tapis', 'bassin_pose', 'bassin_mi', 'bassin_decol')})
        r['tc'].append(t1 - t0)
        r['talon_devant'].append(at(H, t0) - at(pel, t0)); r.setdefault('mt1_devant', []).append(at(MT, t0) - at(pel, t0))
        r['mt1_derriere'].append(at(pel, t1) - at(MT, t1))
        # repère du tapis : le tapis recule à v ; un point posé y est fixe → x + v·t
        r['talon_tapis'].append((at(H, t1) + v * t1) - (at(H, t0) + v * t0))
        r['mt1_tapis'].append((at(MT, t1) + v * t1) - (at(MT, t0) + v * t0))
        r['bassin_pose'].append(at(pely, t0)); r['bassin_mi'].append(at(pely, tm)); r['bassin_decol'].append(at(pely, t1))
for v in sorted(res):
    r = {k: np.array(x) for k, x in res[v].items()}
    mn = lambda k: np.nanmean(r[k])
    print(f"  MT1 devant à la pose {mn('mt1_devant'):.2f} m")
    print(f"seuil {SEUIL:.0f} N — {v} m/s ({len(r['tc'])} appuis) contact {mn('tc'):.3f} s → corps {v * mn('tc'):.2f} m | talon {mn('talon_devant'):.2f} m devant à la pose, MT1 {mn('mt1_derriere'):.2f} m derrière au décollage | au tapis : talon {mn('talon_tapis'):+.2f} m, MT1 {mn('mt1_tapis'):+.3f} m | bassin pose/décollage {100*(mn('bassin_pose')-mn('bassin_mi')):+.1f} / {100*(mn('bassin_decol')-mn('bassin_mi')):+.1f} cm (rel. mi-appui)")
