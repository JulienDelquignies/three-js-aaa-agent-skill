import { run } from './runner.js';
import { Controls } from './scenes/Controls.js';
run(Controls).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });
