import { run } from './runner.js';
import { Interieur } from './scenes/Interieur.js';
run(Interieur).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });
