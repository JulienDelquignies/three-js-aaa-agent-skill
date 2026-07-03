import { run } from './runner.js';
import { Stadiums } from './scenes/Stadiums.js';
run(Stadiums).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });
