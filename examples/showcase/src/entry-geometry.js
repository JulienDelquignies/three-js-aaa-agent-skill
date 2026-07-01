import { run } from './runner.js';
import { Geometry } from './scenes/Geometry.js';
run(Geometry).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });
