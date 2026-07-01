import { run } from './runner.js';
import { Materials } from './scenes/Materials.js';
run(Materials).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });
