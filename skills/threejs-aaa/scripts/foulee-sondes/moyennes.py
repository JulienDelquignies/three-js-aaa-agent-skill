# Courbes moyennes (Fukuchi 2017, RBDS, 39 fichiers × 2 côtés) : angles sagittaux (composante Z : hanche flexion +, genou flexion +,
# cheville dorsiflexion +) sur le cycle (0 % = pose), appui = force verticale non vide. Sortie : points clés + courbes JSON.
import numpy as np, glob, json
out = {}
for sp in ('25', '35', '45'):
    H, K, A, DF = [], [], [], []
    for f in sorted(glob.glob('RBDS*processed.txt')):
        L = open(f).read().splitlines(); h = L[0].split('\t')
        d = np.array([[float(x) if x.strip() not in ('', 'NaN', 'nan') else np.nan for x in (ln.split('\t') + [''] * len(h))[:len(h)]] for ln in L[1:] if ln.strip()])
        for s in 'RL':
            try:
                hip, knee, ank, grf = (d[:, h.index(f'{s}{j}{sp}')] for j in ('hipAngZ', 'kneeAngZ', 'ankleAngZ', 'grfY'))
            except ValueError: continue
            if np.isnan(hip).any() or np.isnan(knee).any(): continue
            st = np.where(np.isnan(grf))[0]; df = (st[0] if len(st) else 101) / 100
            H.append(hip); K.append(knee); A.append(ank); DF.append(df)
    H, K, A, DF = map(np.array, (H, K, A, DF))
    mH, mK, mA = H.mean(0), K.mean(0), A.mean(0)
    to = int(round(100 * DF.mean()))
    out[sp] = { 'n': len(H), 'appui': round(float(DF.mean()), 3), 'appui_sd': round(float(DF.std()), 3),
      'hanche': {'pose': round(float(mH[0]), 1), 'decollage': round(float(mH[to]), 1), 'min': round(float(mH.min()), 1), 'min_pct': int(mH.argmin()), 'max': round(float(mH.max()), 1), 'max_pct': int(mH.argmax())},
      'genou': {'pose': round(float(mK[0]), 1), 'appui_max': round(float(mK[:to].max()), 1), 'decollage': round(float(mK[to]), 1), 'vol_max': round(float(mK[to:].max()), 1), 'vol_max_pct': int(to + mK[to:].argmax())},
      'cheville': {'pose': round(float(mA[0]), 1), 'appui_max': round(float(mA[:to].max()), 1), 'decollage': round(float(mA[to]), 1), 'min': round(float(mA.min()), 1), 'min_pct': int(mA.argmin())},
      'courbes': {'hanche': [round(float(x), 2) for x in mH], 'genou': [round(float(x), 2) for x in mK], 'cheville': [round(float(x), 2) for x in mA]} }
    o = out[sp]; print(f"{int(sp)/10} m/s ({o['n']} jambes) appui {o['appui']}±{o['appui_sd']} | hanche {o['hanche']} | genou {o['genou']} | cheville {o['cheville']}")
json.dump(out, open('rbds-moyennes.json', 'w'))
