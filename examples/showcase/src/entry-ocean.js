import { run } from './runner.js';
import { Ocean } from './scenes/Ocean.js';
run(Ocean).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });
