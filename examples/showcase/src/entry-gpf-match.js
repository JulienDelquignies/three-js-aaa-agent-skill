import { run } from './runner.js';
import { GpfMatch } from './scenes/GpfMatch.js';

// Le lot L0 du cadrage « Football Manager ++ » : le moteur de match de Gameplay Football compilé en WebAssembly, nos humains en three.js.
run(GpfMatch).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'ÉCHEC — voir la console'; });
