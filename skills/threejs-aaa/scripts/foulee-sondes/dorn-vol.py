# Le VOL du sprinter mesuré (Dorn 2012, JA1) → engine/foulee-rbds.js (DORN_VOL) : cuisse globale et genou moyens des cycles, phase de vol
# normalisée (w = 0 au décollage marqué par le labo, 1 à la pose), 21 points, aux vitesses mesurées 5,19 / 6,97 / 9,47 m/s.
import json, re, sys, numpy as np
J = json.load(open('dorn-sprint.json')); keys = ['5.20', '7.00', '9.49']
v = [round(float(J['vitesses'][k]['v']), 2) for k in keys]
cu = [np.mean([c['volCuisse'] for c in J['vitesses'][k]['cycles']], 0).round(1).tolist() for k in keys]
ge = [np.mean([c['volGenou'] for c in J['vitesses'][k]['cycles']], 0).round(1).tolist() for k in keys]
block = "export const DORN_VOL = {\n  v: %s,\n  cuisse: %s,\n  genou: %s,\n};\n" % (json.dumps(v), json.dumps(cu).replace(',', ', ').replace(',  ', ', '), json.dumps(ge).replace(',', ', ').replace(',  ', ', '))
p = sys.argv[1]; s = open(p).read()
s = re.sub(r"export const DORN_VOL = \{.*?\n\};\n", "", s, flags=re.S)
s = s.replace("\n/** La cuisse et le genou de référence", "\n" + block + "\n/** La cuisse et le genou de référence", 1)
open(p, 'w').write(s); print(block[:300])
