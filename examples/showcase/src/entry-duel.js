import { run } from './runner.js';
import { Rondo } from './scenes/Rondo.js';

// Le DUEL 1c1 EST la scène Rondo en mode ?duel (engine/duel-1v1.js : une configuration de rondoStep,
// pas une scène de plus) : l'entrée force le mode avant le boot, comme entry-match force ?match.
const u = new URL(location.href);
if (!u.searchParams.has('duel')) { u.searchParams.set('duel', '1'); history.replaceState(null, '', u); }
run(Rondo).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });

// le tableau du duel : la scène écrit #score (passes du rondo) — la page du duel a le sien, lu sur l'état
const hud = document.getElementById('duelScore');
setInterval(() => {
  const d = window.__scene?.state?._duel;
  if (hud && d) hud.innerHTML = `<b>${d.score[0]}</b> – <b>${d.score[1]}</b> <span style="opacity:.7">· ${d.points} point${d.points > 1 ? 's' : ''}</span>`;
}, 250);
