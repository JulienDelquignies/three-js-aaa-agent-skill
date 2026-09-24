# LE SPRINT MESURÉ — Dorn, Schache & Pandy 2012 (J Exp Biol 215:1944 ; SimTK « runningspeeds », licence MIT) : un sprinter (JA1)
# sur piste instrumentée (8 plateformes, 12 m de capture), 3,56 / 5,20 / 7,00 / 9,49 m/s, marqueurs à 250 Hz, poses et décollages
# marqués par le laboratoire. Repère : Y avant, Z haut, mm.
# Centres articulaires : hanche par Harrington 2007 (ASIS + SACR), genou (épicondyles) et cheville (malléoles) reconstruits depuis
# l'essai statique par corps rigide (Kabsch sur les plaques de cuisse / jambe) ; angles SAGITTAUX (projection avant/haut) :
# cuisse globale (+ = en avant de la verticale), genou (flexion = cuisse − jambe), bassin (antéversion ASIS/SACR − debout).
import c3d, numpy as np, json, sys
R = 250.0
def load(f):
    r = c3d.Reader(open(f, 'rb')); lab = [l.strip() for l in r.point_labels]
    P = np.array([p[:, :3] for _, p, _ in r.read_frames()]); V = np.array([p[:, 3] for _, p, _ in r.read_frames()]) >= 0
    ev = r.get('EVENT'); evs = []
    if ev:
        L = [l.strip() for l in ev.get('LABELS').string_array]; C = [l.strip() for l in ev.get('CONTEXTS').string_array]; T = ev.get('TIMES').float_array
        tt = T[:, 1] if T.shape[1] == 2 else T[1]
        evs = sorted((float(t), c, l) for t, c, l in zip(tt, C, L))
    return lab, P, V, evs, (r.first_frame - 1) / R
def kabsch(A, B):   # R, t : B ≈ A·Rᵀ + t
    ca, cb = A.mean(0), B.mean(0); H = (A - ca).T @ (B - cb); U, S, Vt = np.linalg.svd(H); d = np.sign(np.linalg.det(Vt.T @ U.T))
    D = np.diag([1, 1, d]); Rm = Vt.T @ D @ U.T; return Rm, cb - ca @ Rm.T
def hjc(rasi, lasi, sacr, side):   # Harrington 2007 (PSIS milieu ≈ SACR) ; repère bassin : x avant, y gauche, z haut
    o = (rasi + lasi) / 2; y = lasi - rasi; y /= np.linalg.norm(y); xa = o - sacr; x = xa - (xa @ y) * y; x /= np.linalg.norm(x); z = np.cross(x, y)
    PW = np.linalg.norm(lasi - rasi); PD = np.linalg.norm(o - sacr)
    lx, ly, lz = -0.24 * PD - 9.9, (0.33 * PW + 7.3) * (1 if side == 'L' else -1), -0.30 * PW - 10.9
    return o + lx * x + ly * y + lz * z
S = load('Static/JA1Static05.c3d'); sl, sP, sV = S[0], S[1], S[2]
st = lambda n: sP[:, sl.index(n)][sV[:, sl.index(n)]].mean(0)
CL = {'thigh': ['THLP', 'THLD', 'THAP', 'THAD'], 'shank': ['TIAP', 'TIAD', 'TILAT']}
def centres(lab, P, V, side):
    g = lambda n: P[:, lab.index(side + n)]
    out = {}
    for seg, virt in (('thigh', ('LEPI', 'MEPI')), ('shank', ('LMAL', 'MMAL'))):
        A = np.array([st(side + m) for m in CL[seg]]); vs = np.array([st(side + m) for m in virt])
        cen = np.zeros((len(P), 3))
        for i in range(len(P)):
            B = np.array([P[i, lab.index(side + m)] for m in CL[seg]]); Rm, t = kabsch(A, B); cen[i] = (vs @ Rm.T + t).mean(0)
        out['knee' if seg == 'thigh' else 'ankle'] = cen
    out['hip'] = np.array([hjc(P[i, lab.index('RASI')], P[i, lab.index('LASI')], P[i, lab.index('SACR')], side) for i in range(len(P))])
    for m in ('HEEL', 'TOE', 'P1MT'): out[m] = g(m)
    return out
def ang(v, fwd):   # angle sagittal depuis la verticale basse, + = en avant
    return np.degrees(np.arctan2(v[:, 1] * fwd, -v[:, 2]))
# le bassin debout
def tilt(lab, P, fwd):
    a = (P[:, lab.index('RASI')] + P[:, lab.index('LASI')]) / 2; s = P[:, lab.index('SACR')]; d = a - s
    return np.degrees(np.arctan2(-d[:, 2], d[:, 1] * fwd))   # + = ASIS sous le sacrum (antéversion)
Sfwd = 1
tilt0 = float(np.mean(tilt(sl, sP, 1 if (st('RASI') - st('SACR'))[1] > 0 else -1)))
hip0 = float(np.mean([hjc(st('RASI'), st('LASI'), st('SACR'), s)[2] for s in 'LR']))
res = {}
for name, f, vref in (('3.56', 'Run35ms/JA1Gait21.c3d', 3.56), ('5.20', 'Run5ms/JA1Gait27.c3d', 5.2), ('7.00', 'Run7ms/JA1Gait33.c3d', 7.0), ('9.49', 'Run9ms/JA1Gait35.c3d', 9.49)):
    lab, P, V, evs, t0 = load(f)
    sac = P[:, lab.index('SACR')]; fwd = 1 if sac[-1, 1] > sac[0, 1] else -1
    v = abs(sac[-1, 1] - sac[0, 1]) / 1000 / ((len(P) - 1) / R)
    tl = tilt(lab, P, fwd) - tilt0
    cyc = []
    for side, S_ in (('L', 'Left'), ('R', 'Right')):
        C = centres(lab, P, V, side); th = ang(C['knee'] - C['hip'], fwd); sh = ang(C['ankle'] - C['knee'], fwd); kn = th - sh
        fs = [t for t, c, l in evs if c == S_ and l == 'Foot Strike']; fo = [t for t, c, l in evs if c == S_ and l == 'Foot Off']
        fr = lambda t: int(round((t - t0) * R))
        for a, b in zip(fs, fs[1:]):
            o = [x for x in fo if a < x < b]
            if not o: continue
            ia, ib, io = fr(a), fr(b), fr(o[0])
            if ia < 0 or ib >= len(P): continue
            T = (ib - ia) / R; duty = (io - ia) / (ib - ia)
            u = np.linspace(0, 1, 101); idx = ia + u * (ib - ia)
            K = np.interp(idx, np.arange(len(P)), kn); TH = np.interp(idx, np.arange(len(P)), th); TL = np.interp(idx, np.arange(len(P)), tl)
            w = np.linspace(0, 1, 21); iw = io + w * (ib - io)
            Kw = np.interp(iw, np.arange(len(P)), kn); Tw = np.interp(iw, np.arange(len(P)), th)
            # le talon à la pose : vitesse avant au sol (m/s) sur les 2 images qui précèdent ; hanche absolue vs debout
            hv = (C['HEEL'][ia, 1] - C['HEEL'][ia - 2, 1]) * fwd / 1000 * R / 2
            hipY = C['hip'][:, 2]; hmid = hipY[ia + (io - ia) // 2]
            c7 = P[:, lab.index('C7')]; sacr = P[:, lab.index('SACR')]; tr = c7 - sacr; tronc = np.degrees(np.arctan2(tr[:, 1] * fwd, tr[:, 2]))   # + = penché en avant
            ft = C['TOE'] - C['HEEL']; pied = np.degrees(np.arctan2(ft[:, 2], ft[:, 1] * fwd))                                        # + = pointe haute
            posed = float((C['HEEL'][ia, 1] - C['hip'][ia, 1]) * fwd / 10); decold = float((C['TOE'][io, 1] - C['hip'][io, 1]) * fwd / 10)
            A_ = C['ankle']; Hh = C['hip']; Lj = 925.0
            rel = lambda i: ((A_[i, 1] - Hh[i, 1]) * fwd / Lj, (Hh[i, 2] - A_[i, 2]) / Lj)
            geo = dict(chevillePose=rel(ia), chevilleMi=rel(ia + (io - ia) // 2), chevilleDecol=rel(io), hanchePose_cm=float((Hh[ia, 2] - hip0) / 10), hancheDecol_cm=float((Hh[io, 2] - hip0) / 10),
                       chevilleHautPose_cm=float(A_[ia, 2] / 10), chevilleHautDecol_cm=float(A_[io, 2] / 10), avanceChevilleAppui_L=float(((A_[io, 1] - A_[ia, 1]) * fwd) / Lj), trajetCorps_L=float(v * (io - ia) / R / 0.925))
            cyc.append(dict(**geo, side=side, T=T, f=1 / T, duty=duty, contact=(io - ia) / R, genouPose=float(kn[ia]), genouAppuiMax=float(kn[ia:io + 1].max()), genouDecol=float(kn[io]), genouVolMax=float(kn[io:ib + 1].max()),
                            wPicGenou=float(np.argmax(Kw) / 20), cuissePose=float(th[ia]), cuisseDecol=float(th[io]), cuisseMax=float(th[ia:ib + 1].max()), cuisseMin=float(th[ia:ib + 1].min()),
                            bassin=float(TL.mean()), talonPose=float(hv), talonPoseSurV=float(hv / v), hancheMiAppui_cm=float((hmid - hip0) / 10), hancheOsc_cm=float(np.ptp(hipY[ia:ib + 1]) / 10),
                            tronc=float(tronc[ia:ib + 1].mean()), piedPose=float(pied[ia]), piedDecol=float(pied[io]), talonDevantHanche_cm=posed, orteilDevantHanchePose_cm=float((C['TOE'][ia, 1] - C['hip'][ia, 1]) * fwd / 10), orteilDerriereHanche_cm=decold,
                            volGenou=Kw.round(1).tolist(), volCuisse=Tw.round(1).tolist(), cycleGenou=K.round(1).tolist(), cycleCuisse=TH.round(1).tolist()))
    res[name] = dict(v=round(v, 2), cycles=cyc)
    m = lambda k: np.mean([c[k] for c in cyc]); sd = lambda k: np.std([c[k] for c in cyc])
    print(f"{name} m/s (mesuré {v:.2f}) : {len(cyc)} cycles | f {m('f'):.3f} Hz, appui {m('contact')*1000:.0f} ms, facteur {m('duty'):.3f} | genou pose {m('genouPose'):.0f}, appui max {m('genouAppuiMax'):.0f}, décol {m('genouDecol'):.0f}, VOL MAX {m('genouVolMax'):.0f}±{sd('genouVolMax'):.0f} (w {m('wPicGenou'):.2f}) | cuisse pose {m('cuissePose'):.0f}, décol {m('cuisseDecol'):.0f}, max {m('cuisseMax'):.0f}, min {m('cuisseMin'):.0f} | bassin +{m('bassin'):.1f}° | talon pose {m('talonPoseSurV'):.2f}·v | hanche mi-appui {m('hancheMiAppui_cm'):.1f} cm, osc {m('hancheOsc_cm'):.1f} | tronc {m('tronc'):.0f}° | pied pose {m('piedPose'):.0f}° décol {m('piedDecol'):.0f}° | talon à la pose {m('talonDevantHanche_cm'):.0f} cm devant la hanche, orteil au décol {m('orteilDerriereHanche_cm'):.0f} cm")
L = float(np.mean([np.linalg.norm(hjc(st('RASI'), st('LASI'), st('SACR'), sd) - (st(sd + 'LMAL') + st(sd + 'MMAL')) / 2) for sd in 'LR']))
print('jambe (hanche-cheville debout) %.3f m' % (L / 1000))
json.dump(dict(jambe_m=L / 1000, source='Dorn, Schache & Pandy 2012 — SimTK runningspeeds (MIT), sujet JA1', hanche_debout_mm=float(hip0), bassin_debout_deg=float(tilt0), vitesses=res), open('dorn-sprint.json', 'w'), default=float)
