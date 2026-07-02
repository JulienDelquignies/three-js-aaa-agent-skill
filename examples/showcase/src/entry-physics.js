import { run } from './runner.js';
import { PhysicsScene } from './scenes/Physics.js';
run(PhysicsScene).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });
