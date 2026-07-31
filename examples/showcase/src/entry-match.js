import { run } from './runner.js';
import { Rondo } from './scenes/Rondo.js';

// Le match réduit EST la scène Rondo en mode ?match (une scène, deux configurations du moteur —
// pas deux scènes) : l'entrée force le mode avant le boot.
const u = new URL(location.href);
if (!u.searchParams.has('match')) { u.searchParams.set('match', '1'); history.replaceState(null, '', u); }
run(Rondo).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });
