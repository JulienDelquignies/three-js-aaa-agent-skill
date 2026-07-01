import { run } from './runner.js';
import { Neon } from './scenes/Neon.js';
run(Neon).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });
