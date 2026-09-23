/** LE CONTACT A SON DÉCLENCHEUR (lot 294, cfg.contactDeclenche — Bible 10 § 7, les déclencheurs de pressing ; Bible 05, le
 *  recul-frein : « reculer face au porteur, 2-3 m de distance »). Sondé (sonde-294, 4 × 90 min, au monde du 293) : ~71 contacts
 *  engagés par la défense sur le porteur par équipe et par match (charges d'épaule 19-22, piques 23-27 tentées, fautes 17 — le réel
 *  ~11 —, glissés 5-9) ; 36-38 % SANS AUCUN déclencheur (~26 par équipe, 5-9 ballons gagnés) : le défenseur à portée engage parce
 *  qu'il est à portée. Le vrai défenseur cadre : il ne s'engage que sur signal.
 *
 *  La loi : le défenseur n'engage le contact (la charge d'épaule, la pique, le glissé, la morsure du jockey) que si un déclencheur
 *  vit — T1 la TOUCHE EXPOSÉE (le ballon à plus de `expose` m du porteur : le mauvais contrôle, la conduite trop longue), T2 le DOS
 *  AU BUT (le porteur tourné vers son camp, cos > dos), T3 la LIGNE (à moins de `ligne` m de la touche : le piège de la craie), T4
 *  PLUS DE RECUL (le porteur à moins de `recul` m du but défendu : le cadrage n'a plus d'espace derrière lui), T5 la RÉCEPTION
 *  FRAÎCHE (le porteur tient depuis moins de `frais` s : la pression au départ de la passe, Gourcuff), T6 la FENÊTRE de pressing
 *  collective (pressTriggers, déjà à la tactique pressing et à l'anticipation du bloc). Sinon il cadre (le jockey, la garde).
 *  Attributs : les déclencheurs T5/T6 lisent déjà l'anticipation (la fenêtre) ; la note de tacle joue à l'exécution. Tactique :
 *  pressing, par la fenêtre T6. Rôles : rien. Clé absente : le contact d'hier au bit. */
export function declencheDe(st, c, K) {
  const memo = st._declMemo;
  if (memo && memo.t === st.t && memo.id === c.id) return memo.v;
  const bx = st.ball.p[0] - c.p[0], bz = st.ball.p[2] - c.p[2];
  const og = st.pitch.ownGoal(c.team).x, dg = st.pitch.ownGoal(1 - c.team).x;
  const v = Math.hypot(bx, bz) > (K.expose ?? 1.2) ? 'expose'
    : Math.cos(c.yaw - Math.atan2(-c.p[2], og - c.p[0])) > (K.dos ?? 0.5) ? 'dos'
    : st.pitch.hz - Math.abs(c.p[2]) < (K.ligne ?? 5) ? 'ligne'
    : Math.abs(c.p[0] - dg) < (K.recul ?? 25) ? 'recul'
    : st.hold < (K.frais ?? 0.6) ? 'frais'
    : st._press && st._press.team !== c.team && st._press.until > st.t ? 'fenetre' : null;
  st._declMemo = { t: st.t, id: c.id, v };
  return v;
}
