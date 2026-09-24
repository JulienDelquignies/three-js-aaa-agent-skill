# Le VOL réaligné coureur par coureur : chaque jambe est découpée à SON décollage (la première valeur vide de la force verticale des
# courbes traitées) puis rééchantillonnée sur w ∈ [0,1] — la moyenne ne mélange plus des appuis tardifs au début du vol.
import numpy as np, glob, json
N = 21; out = {}
for sp in ('25', '35', '45'):
    TH, KN, TOs = [], [], []
    tilt = json.load(open('rbds-moyennes.json'))['_bassin'][sp]
    for f in sorted(glob.glob('RBDS*processed.txt')):
        L = open(f).read().splitlines(); h = L[0].split('\t')
        d = np.array([[float(x) if x.strip() not in ('', 'NaN', 'nan') else np.nan for x in (ln.split('\t') + [''] * len(h))[:len(h)]] for ln in L[1:] if ln.strip()])
        for s in 'RL':
            try: hip, knee, grf = (d[:, h.index(f'{s}{j}{sp}')] for j in ('hipAngZ', 'kneeAngZ', 'grfY'))
            except ValueError: continue
            if np.isnan(hip).any() or np.isnan(knee).any(): continue
            nn = np.where(np.isnan(grf))[0]
            if not len(nn): continue
            to = nn[0]; TOs.append(to)
            x = np.arange(101); w = np.linspace(0, 1, N); pct = to + w * (100 - to)
            TH.append(np.interp(pct, x, hip - tilt)); KN.append(np.interp(pct, x, knee))
    TH, KN = np.array(TH).mean(0), np.array(KN).mean(0)
    out[sp] = {'cuisse': [round(float(a), 1) for a in TH], 'genou': [round(float(a), 1) for a in KN], 'to_pct': float(np.mean(TOs))}
    print(sp, 'décollage (fin du non-vide) %', round(np.mean(TOs), 1), '| genou', out[sp]['genou'][:5], '… max', max(out[sp]['genou']), '| cuisse', out[sp]['cuisse'][:5], '… max', max(out[sp]['cuisse']))
json.dump(out, open('vol-aligne.json', 'w'))
