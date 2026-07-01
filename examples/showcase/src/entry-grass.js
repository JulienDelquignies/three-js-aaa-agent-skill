import { run } from './runner.js';
import { Grass } from './scenes/Grass.js';
run(Grass).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });
