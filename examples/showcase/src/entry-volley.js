import { run } from './runner.js';
import { SoldierVolley } from './scenes/SoldierVolley.js';
run(SoldierVolley, { thumbTime: 3.3 }).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });
