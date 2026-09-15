// rondo-fete — LA FÊTE ET L'HUMEUR DANS LA SCÈNE (lot A11 : motion-emotion + referee.fete).
//
// Tout se lit de la sim, rien ne s'invente :
//   - la CÉLÉBRATION (événement 'celebration', geste posé par la persona sous cfg.fete) : le poing, les bras levés et le
//     retour calme se jouent tout de suite EN COURANT (gestes du haut : les jambes restent à la foulée) ; la main à
//     l'oreille attend l'ARRIVÉE au coin (le buteur s'arrête face à la tribune) ; la GLISSADE attend l'événement 'glissade'
//     de la sim (le corps porté par movement._glisse, tenu au sol par down — le clip tient sa pose et se relève à l'heure
//     sim par contactClock, comme une chute) ;
//   - les COMPAGNONS (avec) courent au buteur (sim) ; à ≤ 1,4 m et au pas, l'ACCOLADE, des deux côtés ;
//   - l'ADVERSAIRE ABATTU : pendant la fête, l'équipe qui a encaissé marche tête basse, les mains sur les hanches
//     (idleCtx.abattu → l'attente 'abattu' et la foulée mainsHanches + headDown) ;
//   - la PROTESTATION : le fautif dont la persona n'est pas calme (calm < 1,08) ouvre les bras à l'arbitre ; le carton
//     fait protester tout le monde.
// Sans cfg.fete (événement sans geste) : les bras levés — le geste d'hier, généré.

/** Les événements de la fête et de l'humeur. */
export function feteEvent(scene, e) {
  if (e.type === 'celebration') {
    const pl = scene.players[e.by]; if (!pl) return;
    const g = e.geste ?? 'brasLeves';
    pl._fete = { geste: g, t: scene._t, played: false };
    if (g === 'poing' || g === 'brasLeves' || g === 'calme') { scene._playTech(pl, { ...e, move: g }); pl._fete.played = true; pl._teched = scene._t; }
    for (const id of e.avec ?? []) { const q = scene.players[id]; if (q) q._fete = { geste: 'accolade', t: scene._t, played: false, avec: e.by }; }
  } else if (e.type === 'glissade') {
    const pl = scene.players[e.by]; if (!pl) return;
    pl._sol = null; scene._playTech(pl, { ...e, move: 'glissade' }); pl._teched = scene._t; if (pl._fete) pl._fete.played = true;
  } else if (e.type === 'faute' || e.type === 'carton') {
    const pl = scene.players[e.by]; if (!pl) return;
    const calm = pl.sim.persona?.calm ?? 1;
    if ((e.type === 'carton' || calm < 1.08) && !pl.gestureLayer.active && (pl.sim.down ?? 0) <= 0 && !pl.sim.act) { scene._playTech(pl, { ...e, move: 'proteste' }); pl._teched = scene._t; }
  }
}

/** Par joueur, par image : les gestes qui attendent leur instant (l'oreille à l'arrivée, l'accolade au contact) ;
 *  renvoie vrai pour l'adversaire abattu (l'équipe qui a encaissé, pendant la fête). */
export function feteStep(scene, pl) {
  const st = scene.state, s = pl.sim, C = st._celeb;
  if (!C) { if (pl._fete) pl._fete = null; return false; }
  const F = pl._fete;
  if (F && !F.played && !pl.gestureLayer.active && !s.act && (s.down ?? 0) <= 0) {
    const v = pl.ctrl.speed ?? 0;
    if (F.geste === 'oreille') { if (v < 0.8 && scene._t - F.t > 1.5) { scene._playTech(pl, { type: 'fete', move: 'oreille' }); F.played = true; pl._teched = scene._t; } }
    else if (F.geste === 'accolade') {
      const b = scene.players[F.avec];
      if (b && Math.hypot(b.sim.p[0] - s.p[0], b.sim.p[2] - s.p[2]) < 1.6 && v < 2.2) {   // au contact, au pas ou au trot (mesuré : le compagnon trottait à 1,5 m/s à côté du buteur qui glissait)
        scene._playTech(pl, { type: 'fete', move: 'accolade' }); F.played = true; pl._teched = scene._t;
        if (b._fete && !b.gestureLayer.active && !b.sim.act && (b.sim.down ?? 0) <= 0) { scene._playTech(b, { type: 'fete', move: 'accolade' }); b._teched = scene._t; }
      }
    } else if (F.geste === 'glissade' && scene._t - F.t > 4.5) F.played = true;   // la sim n'a pas lancé la glissade (trop lent au moment de l'élan) : rien de plus
  }
  const scorer = st.players[C.by];
  return !!scorer && s.team !== scorer.team && !s.keeper;
}
