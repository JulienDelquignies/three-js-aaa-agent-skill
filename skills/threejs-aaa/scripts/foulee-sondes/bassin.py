# Inclinaison antérieure du bassin (ligne milieu PSIS → milieu ASIS, plan sagittal ; X avant, Y haut, mm) : moyenne et amplitude
# crête-crête sur l'essai, par vitesse — ce qui relie la hanche de Visual3D (relative au bassin CODA) à la cuisse GLOBALE du générateur.
import numpy as np, glob, re
res = {}
for f in sorted(glob.glob('mk/RBDS*markers.txt')):
    sp = re.search(r'T(\d\d)markers', f).group(1)
    L = open(f).read().splitlines(); h = L[0].split('\t')
    d = np.array([[float(x) if x.strip() not in ('', 'NaN') else np.nan for x in (ln.split('\t') + [''] * len(h))[:len(h)]] for ln in L[1:] if ln.strip()])
    col = lambda n: d[:, h.index(n)]
    ax = (col('R.ASISX') + col('L.ASISX')) / 2; ay = (col('R.ASISY') + col('L.ASISY')) / 2
    px = (col('R.PSISX') + col('L.PSISX')) / 2; py = (col('R.PSISY') + col('L.PSISY')) / 2
    tilt = np.degrees(np.arctan2(py - ay, np.abs(ax - px)))          # + = ASIS plus bas que PSIS (antérieure)
    tilt = tilt[~np.isnan(tilt)]
    res.setdefault(sp, []).append((tilt.mean(), np.percentile(tilt, 95) - np.percentile(tilt, 5)))
for sp, v in sorted(res.items()):
    v = np.array(v); print(f'{int(sp)/10} m/s : {len(v)} coureurs, inclinaison moyenne {v[:,0].mean():.1f}° ± {v[:,0].std():.1f}, oscillation {v[:,1].mean():.1f}°')
