// corps-arret.js — LE CORPS S'ARRÊTE AVEC SON CONTRÔLE (326, cfg.corpsArret && st.full — retour utilisateur : « toujours trop long, la deuxième touche »).
// Tracé (sonde trace-ctl, monde 325) : dans les contrôles lents (> 1 s avant la 2e touche), le contrôle AMORTIT le ballon (0-0,8 m/s après la touche)
// mais le corps file sur son élan à 3-4,5 m/s : il DÉPASSE son ballon (à 90-150° de son regard 0,3 s plus tard), freine, se retourne et revient —
// 1-2 s. Le vrai receveur freine AVEC son contrôle : ses derniers appuis se posent pendant que le ballon meurt. Ici, au contrôle, si le ballon repart
// dans la direction de course plus lentement que le corps (écart > seuil m/s), la vitesse du corps dans cette direction se rapproche de celle du
// ballon : v_axe ← v_ballon + (v_axe − v_ballon) × (1 − frein × min(1,3, controlF) / 1,15) — le bon contrôleur reste sur son ballon, le médiocre
// glisse un peu plus loin. La composante latérale est gardée. Une vitesse, jamais une position. Absente : l'élan d'hier au bit.
import { hyp } from './hyp.js';

export function corpsArret(st, p, K) {
  const sp = hyp(p.v[0], p.v[1]); if (sp < (K.vMin ?? 1.5)) return;
  const ux = p.v[0] / sp, uz = p.v[1] / sp, vb = st.ball.v[0] * ux + st.ball.v[2] * uz;
  if (sp - vb < (K.seuil ?? 1)) return;
  const f = Math.min(0.95, (K.frein ?? 0.7) * Math.min(1.3, p.skill?.controlF ?? 1.15) / 1.15);
  const vAxe = Math.max(0, vb) + (sp - Math.max(0, vb)) * (1 - f), d = vAxe - sp;
  p.v[0] += ux * d; p.v[1] += uz * d; p.speed = hyp(p.v[0], p.v[1]);
}
