# LA FOULÉE D'UN BVH (100STYLE, Mason et al. 2022, Zenodo 8127870, CC BY 4.0 — un acteur, combinaison inertielle Xsens, 60 i/s) :
# cinématique directe, contacts par la hauteur ET la vitesse du pied, cycles en ligne droite (le lacet du bassin stable), et par cycle :
# vitesse (le long du regard : < 0 = à reculons), fréquence de foulée, facteur d'appui, genou, cuisse globale, pied, hanche / debout,
# cheville par rapport à la hanche à la pose et au décollage (en longueurs de jambe hanche → cheville).
# Usage : python3 recul-100style.py Neutral_BR.bvh [Neutral_ID.bvh pour la station debout] > sortie.json  (Neutral_{FW,BW,FR,BR}.bvh de 100STYLE.zip ;
# recul-100style.json = les médianes des cycles en ligne droite, pieds au sol par hauteur + vitesse — voir recul-vers-moteur.py)
import sys, json, re, os, numpy as np
YAWMAX = float(os.environ.get("YAWMAX", "1.2"))   # rad/s : l acteur de 100STYLE tourne en rond (lacet p50 ~1 rad/s) — à 0,6 il ne reste que 4 cycles de course

def lire(path):
    txt = open(path).read(); head, motion = txt.split('MOTION')
    joints, stack, cur = [], [], None
    for line in head.splitlines():
        t = line.split()
        if not t: continue
        if t[0] in ('ROOT', 'JOINT'): cur = {'name': t[1], 'parent': stack[-1] if stack else None, 'off': None, 'ch': [], 'end': None}; joints.append(cur)
        elif t[0] == 'End': cur = {'name': (stack[-1]['name'] if stack else '') + '_End', 'parent': stack[-1], 'off': None, 'ch': [], 'endsite': True}; joints.append(cur)
        elif t[0] == '{': stack.append(cur)
        elif t[0] == '}': stack.pop()
        elif t[0] == 'OFFSET': cur['off'] = np.array([float(x) for x in t[1:4]])
        elif t[0] == 'CHANNELS': cur['ch'] = t[2:]
    lines = motion.strip().splitlines(); dt = float(lines[1].split()[-1])
    data = np.array([[float(x) for x in l.split()] for l in lines[2:]])
    return joints, data, dt

def rot(axis, deg):
    a = np.radians(deg); c, s = np.cos(a), np.sin(a); n = len(a); R = np.zeros((n, 3, 3)); R[:, 0, 0] = R[:, 1, 1] = R[:, 2, 2] = 1
    i, j = {'X': (1, 2), 'Y': (2, 0), 'Z': (0, 1)}[axis]
    R[:, i, i] = c; R[:, j, j] = c; R[:, i, j] = -s; R[:, j, i] = s
    return R

def fk(joints, data):
    n = len(data); pos, R, k = {}, {}, 0
    for jn in joints:
        chs = jn['ch']; vals = data[:, k:k + len(chs)]; k += len(chs)
        Rl = np.tile(np.eye(3), (n, 1, 1)); tl = np.zeros((n, 3))
        for c, col in zip(chs, vals.T):
            if c.endswith('position'): tl['XYZ'.index(c[0])] if False else None; tl[:, 'XYZ'.index(c[0])] = col
            else: Rl = Rl @ rot(c[0], col)
        p = jn['parent']
        if p is None: pos[jn['name']] = tl + jn['off']; R[jn['name']] = Rl
        else:
            pos[jn['name']] = pos[p['name']] + np.einsum('nij,j->ni', R[p['name']], jn['off']) + (np.einsum('nij,nj->ni', R[p['name']], tl) if 'Xposition' in chs else 0)
            R[jn['name']] = R[p['name']] @ Rl
    return pos, R

def lisse(x, k=5):
    w = np.ones(k) / k; return np.convolve(np.pad(x, (k // 2, k // 2), mode='edge'), w, mode='valid')

def analyse(path, debout=None):
    joints, data, dt = lire(path); P, R = fk(joints, data); n = len(data)
    unit = 0.01 if np.median(P['Hips'][:, 1]) > 20 else 1.0          # cm → m
    P = {k: v * unit for k, v in P.items()}
    up = 1
    hipL, hipR = P['LeftHip'], P['RightHip']; mid = (hipL + hipR) / 2
    lat = hipR - hipL; lat[:, up] = 0; lat /= np.linalg.norm(lat, axis=1, keepdims=True)
    fwd = -np.cross(lat, np.array([0, 1, 0]))                          # l'avant du bassin (vérifié par la course avant : v > 0)
    vel = np.gradient(mid, dt, axis=0); vel[:, up] = 0
    vf = lisse(np.einsum('ni,ni->n', vel, fwd), 15)
    yaw = np.unwrap(np.arctan2(fwd[:, 0], fwd[:, 2])); yawRate = np.gradient(lisse(yaw, 15), dt)
    legL = np.median(np.linalg.norm(P['LeftHip'] - P['LeftKnee'], axis=1) + np.linalg.norm(P['LeftKnee'] - P['LeftAnkle'], axis=1))
    out = {'fichier': path.split('/')[-1], 'legL': round(float(legL), 4), 'cycles': []}
    sol = {}
    for s in ('Left', 'Right'):
        toe, ank = P[s + 'Toe'], P[s + 'Ankle']
        low = np.minimum(toe[:, up], ank[:, up]); vH = np.linalg.norm(np.gradient(np.minimum.reduce([toe, toe]), dt, axis=0)[:, [0, 2]], axis=1)
        g = np.percentile(low, 5); sol[s] = g
        # contact : le point le plus bas du pied (orteil ou cheville) à < 3 cm de son sol ET pied horizontalement lent (< 1 m/s)
        vA = np.linalg.norm(np.gradient(ank, dt, axis=0)[:, [0, 2]], axis=1)
        c = (low - g < 0.03) & (np.minimum(vH, vA) < 1.0)
        c = lisse(c.astype(float), 3) > 0.5
        out[s] = c
    deb = None
    if debout:
        jd, dd, _ = lire(debout); Pd, _ = fk(jd, dd); Pd = {k: v * unit for k, v in Pd.items()}
        deb = float(np.median((Pd['LeftHip'][:, 1] + Pd['RightHip'][:, 1]) / 2 - np.minimum(Pd['LeftAnkle'][:, 1], Pd['RightAnkle'][:, 1])))
        debPied = {s: float(np.median(np.degrees(np.arctan2(Pd[s + 'Toe'][:, 1] - Pd[s + 'Ankle'][:, 1], np.linalg.norm((Pd[s + 'Toe'] - Pd[s + 'Ankle'])[:, [0, 2]], axis=1))))) for s in ('Left', 'Right')}
    for s in ('Left', 'Right'):
        c = out[s]; td = np.where(c[1:] & ~c[:-1])[0] + 1; to = np.where(~c[1:] & c[:-1])[0] + 1
        hip, knee, ank, toe = P[s + 'Hip'], P[s + 'Knee'], P[s + 'Ankle'], P[s + 'Toe']
        th = hip - knee; sh = ank - knee; kneeA = 180 - np.degrees(np.arccos(np.clip(np.einsum('ni,ni->n', th, sh) / np.linalg.norm(th, axis=1) / np.linalg.norm(sh, axis=1), -1, 1)))
        d = knee - hip; thigh = np.degrees(np.arctan2(np.einsum('ni,ni->n', d, fwd), -d[:, 1]))                # cuisse globale : + = genou devant
        f = toe - ank; pied = np.degrees(np.arctan2(f[:, 1], np.einsum('ni,ni->n', f, fwd))) - (debPied[s] if deb else 0)   # + = pointe relevée (repère du bassin), moins debout
        rel = ank - hip; relF = np.einsum('ni,ni->n', rel, fwd) / legL                                      # cheville devant la hanche (+), en L
        hh = ((hipL[:, 1] + hipR[:, 1]) / 2 - min(sol.values()) - (deb or 0)) / legL
        for a, b in zip(td[:-1], td[1:]):
            T = (b - a) * dt
            if not (0.25 < T < 2.5): continue
            tos = to[(to > a) & (to < b)]
            if len(tos) != 1: continue
            t1 = tos[0]; seg = slice(a, b)
            if np.max(np.abs(yawRate[seg])) > YAWMAX: continue                # (presque) ligne droite : l acteur tourne en rond
            v = float(np.mean(vf[seg]))
            def cyc(x): xs = x[a:b + 1]; return np.interp(np.linspace(0, 1, 51), np.linspace(0, 1, len(xs)), xs).round(2).tolist()
            out['cycles'].append({'cote': s, 'v': round(v, 3), 'f': round(1 / T, 3), 'appui': round((t1 - a) / (b - a), 3),
                'genou': cyc(kneeA), 'cuisse': cyc(thigh), 'pied': cyc(pied), 'hanche': cyc(hh), 'chevilleAvant': cyc(relF),
                'pose': {'genou': round(float(kneeA[a]), 1), 'cuisse': round(float(thigh[a]), 1), 'pied': round(float(pied[a]), 1), 'cheville': round(float(relF[a]), 3)},
                'decol': {'genou': round(float(kneeA[t1]), 1), 'cuisse': round(float(thigh[t1]), 1), 'pied': round(float(pied[t1]), 1), 'cheville': round(float(relF[t1]), 3)},
                'genouVolMax': round(float(np.max(kneeA[t1:b])), 1), 'genouAppuiMax': round(float(np.max(kneeA[a:t1 + 1])), 1),
                'orteilDabord': bool(toe[a, 1] - sol[s] < ank[a, 1] - np.percentile(ank[:, 1], 5))})
    del out['Left'], out['Right']
    return out

if __name__ == '__main__':
    r = analyse(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    C = r['cycles']; print(json.dumps(r))
    vs = np.array([c['v'] for c in C])
    print(f"{r['fichier']} : {len(C)} cycles en ligne droite, jambe {r['legL']} m, v p10/p50/p90 {np.percentile(vs, [10, 50, 90]).round(2) if len(vs) else '-'}", file=sys.stderr)
