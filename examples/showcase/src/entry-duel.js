import { run } from './runner.js';
import { Rondo } from './scenes/Rondo.js';

// Le DUEL 1c1 EST la scène Rondo en mode ?duel (engine/duel-1v1.js : un match sur la cage, lois du 11c11,
// pas une scène de plus) : l'entrée force le mode avant le boot, comme entry-match force ?match.
const u = new URL(location.href);
if (!u.searchParams.has('duel')) { u.searchParams.set('duel', '1'); history.replaceState(null, '', u); }
run(Rondo).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });

// le tableau du duel : la scène écrit #score (passes du rondo) — la page du duel a le sien, lu sur l'état
const hud = document.getElementById('duelScore');
setInterval(() => {
  const s = window.__scene?.state;
  if (hud && s?.score) hud.innerHTML = `<b>${s.score[0]}</b> – <b>${s.score[1]}</b>`;
}, 250);
