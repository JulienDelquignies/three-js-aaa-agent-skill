import { run } from './runner.js';
import { Rondo } from './scenes/Rondo.js';
run(Rondo).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });
