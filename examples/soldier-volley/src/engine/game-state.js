// game-state — the FM-side data layer of the DS game, SEPARATE from the 3D: the 3D world and the
// diegetic UI (phone/computer) both READ this one store and both can act on it (the restaurant
// meeting pushes a message; the phone map triggers the same travel as the pads). Dependency-free,
// seeded → deterministic roster/budget for a given (seed, level). See reference/35.
const mulberry = (seed) => { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let x = Math.imul(t ^ (t >>> 15), 1 | t); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };

const FIRST = ['Théo', 'Rayan', 'Noa', 'Ilan', 'Marco', 'Adem', 'Louis', 'Kylian', 'Sacha', 'Enzo', 'Mattéo', 'Yanis', 'Diego', 'Aksel', 'Pablo', 'Nino'];
const LAST = ['Delcourt', 'Ndiaye', 'Marchetti', 'Bouras', 'Keller', 'Fontaine', 'Diallo', 'Silva', 'Renard', 'Costa', 'Lambert', 'Meunier', 'Barros', 'Guedes', 'Petit', 'Zanetti'];
const POSTES = ['G', 'D', 'D', 'D', 'D', 'M', 'M', 'M', 'M', 'A', 'A', 'A', 'M', 'D'];

export function makeGameState({ seed = 1, level = 1 } = {}) {
  const rnd = mulberry(seed * 4801 + level * 97 + 11);
  const base = 48 + level * 6;                                   // squad quality follows the club level
  const players = POSTES.map((poste, i) => ({
    id: `p${i}`, poste,
    name: `${FIRST[(rnd() * FIRST.length) | 0]} ${LAST[(rnd() * LAST.length) | 0]}`,
    age: 18 + ((rnd() * 15) | 0),
    note: Math.min(88, Math.round(base + rnd() * 14)),
  }));
  const state = {
    level, seed,
    budget: Math.round(level * level * 1.8 * 10) / 10,           // M€ — transfer kitty by level
    cash: level * level * 60,                                    // k€ — the DS's PERSONAL money
    car: { kind: 'berline', color: 0xb3252f, name: 'Berline de fonction' },
    players,
    messages: [], unread: 0,
    addMessage({ from, text }) { state.messages.unshift({ from, text, t: state.messages.length }); state.unread++; },
    markRead() { state.unread = 0; },
    /** Buy a car from the dealership catalogue — refuses if it can't be afforded. */
    buyCar(entry, color) {
      if (entry.price > state.cash) return { ok: false, reason: 'insufficient funds' };
      state.cash = Math.round(state.cash - entry.price);
      state.car = { kind: entry.kind, color, name: entry.name };
      state.addMessage({ from: 'Concessionnaire', text: `Félicitations pour votre ${entry.name} ! (${entry.price} k€) Les clés sont dessus. 🔑` });
      return { ok: true };
    },
  };
  state.addMessage({ from: 'Président', text: `Bienvenue. Budget transferts : ${state.budget} M€. Faites-nous monter.` });
  return state;
}
