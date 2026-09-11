// ks-263 — le D_KS entre deux dépôts de sonde-263 (durées de possession d'équipe) et les écarts de moyenne (test 3 du Modèle 01).
import { readFileSync } from 'node:fs';
const [A, B] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, 'utf8')));
const ks = (a, b) => { const X = [...a].sort((x, y) => x - y), Y = [...b].sort((x, y) => x - y); let i = 0, j = 0, d = 0; while (i < X.length && j < Y.length) { if (X[i] <= Y[j]) i++; else j++; d = Math.max(d, Math.abs(i / X.length - j / Y.length)); } return d; };
const pc = (x, y) => (100 * (y / Math.max(1e-9, x) - 1)).toFixed(1) + ' %';
console.log(`${JSON.stringify(A.over)} → ${JSON.stringify(B.over)} : D_KS(possession d'équipe) ${ks(A.poss, B.poss).toFixed(3)} (cible < 0,03) ; écart de moyenne passes ${pc(A.passes, B.passes)}, tirs ${pc(A.tirs, B.tirs)}, buts ${pc(A.buts, B.buts)}, conservées ${(100 * (B.gardees / B.passes - A.gardees / A.passes)).toFixed(1)} pts (cible < 5 %)`);
