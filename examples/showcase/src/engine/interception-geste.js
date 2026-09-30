// interception-geste.js — L'INTERCEPTION EST UN CONTRÔLE, PAS UN AIMANT (cfg.interceptionGeste && st.full — registre des règles
// irréalistes, lot 359 : « l'interception et la récupération tuent 80 % de la vitesse du ballon sans geste »). Mesuré (diag-B) : 127
// « contrôles » sans technique par 4 × 900 s — rondo.turnover amortissait le ballon de 80 % sur place et le possédait, sans direction,
// quelle que soit la hauteur ; le récupérateur libre restait planté sur son ballon mort. Le réel : le défenseur qui coupe une passe
// avec de l'espace l'EMMÈNE d'une première touche (côté ouvert, dans sa course) ; pressé, il l'amortit — du pied, de la cuisse ou de la
// poitrine selon la hauteur. Ici : libre, la touche orientée du receveur (touche-orientee.js) ; sinon l'amorti d'hier, NOMMÉ.
// Clé absente : l'hier au bit.
import { toucheOrientee } from './touche-orientee.js';

/** La technique de l'amorti selon la hauteur du ballon. Pure. */
export function techPrise(h) { return h > 1.0 ? 'amorti-poitrine' : h > 0.5 ? 'amorti-cuisse' : 'controle-interieur'; }

/** La prise de turnover : { oriente: true, tech } si la touche l'a emmené (le ballon reste libre), { tech } sinon, null sans la clé. */
export function priseInterception(st, w, cfg) {
  const K = st.full && cfg?.interceptionGeste; if (!K || !w) return null;
  const tech = techPrise(st.ball.p[1]);
  if (K.oriente !== false && st.ball.p[1] < (K.hMax ?? 0.5) && toucheOrientee(st, w, cfg, null)) return { oriente: true, tech: 'touche-orientee' };
  return { tech };
}
