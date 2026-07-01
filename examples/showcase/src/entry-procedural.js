import { run } from './runner.js';
import { Procedural } from './scenes/Procedural.js';
run(Procedural).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });
