import { run } from './runner.js';
import { Places } from './scenes/Places.js';
run(Places).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });
