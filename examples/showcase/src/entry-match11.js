import { run } from './runner.js';
import { Rondo } from './scenes/Rondo.js';

// LE 11C11 EST LA MÊME SCÈNE ET LE MÊME MOTEUR — l'entrée force la configuration (match + full),
// exactement comme le match réduit force ?match : une config, jamais un fork.
const u = new URL(location.href);
if (!u.searchParams.has('match')) u.searchParams.set('match', '1');
if (!u.searchParams.has('full')) u.searchParams.set('full', '1');
history.replaceState(null, '', u);
run(Rondo).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });
