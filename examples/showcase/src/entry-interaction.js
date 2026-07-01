import { run } from './runner.js';
import { InteractionIK } from './scenes/InteractionIK.js';
run(InteractionIK).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });
