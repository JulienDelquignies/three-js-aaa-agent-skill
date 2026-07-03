import { run } from './runner.js';
import { Carriere } from './scenes/Carriere.js';
run(Carriere).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });
