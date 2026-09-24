# Cadence des coureurs RBDS : fréquence dominante de l'altitude du talon droit (une oscillation par foulée), 14 coureurs × 3 vitesses.
import numpy as np, glob, re
res = {}
for f in sorted(glob.glob('mk/RBDS*markers.txt')):
    sp = re.search(r'T(\d\d)markers', f).group(1)
    L = open(f).read().splitlines(); h = L[0].split('\t')
    k = next((i for i, n in enumerate(h) if re.match(r'R\.Heel.*Y$', n)), None)
    if k is None: continue
    t = np.array([float(ln.split('\t')[0]) for ln in L[1:] if ln.strip()])
    y = np.array([float(x) if x.strip() not in ('', 'NaN') else np.nan for x in [(ln.split('\t') + [''] * len(h))[k] for ln in L[1:] if ln.strip()]])
    ok = ~np.isnan(y); t, y = t[ok], y[ok] - y[ok].mean(); dt = np.median(np.diff(t))
    F = np.fft.rfft(y * np.hanning(len(y))); fr = np.fft.rfftfreq(len(y), dt); m = (fr > 0.8) & (fr < 2.5)
    f0 = fr[m][np.argmax(np.abs(F[m]))]
    res.setdefault(sp, []).append(f0)
for sp, v in sorted(res.items()):
    v = np.array(v); print(f'{int(sp)/10} m/s : {len(v)} coureurs, foulée {v.mean():.3f} ± {v.std():.3f} Hz → {120 * v.mean():.0f} pas/min, longueur de foulée {int(sp) / 10 / v.mean():.2f} m')
