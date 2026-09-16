// rondo-remises — LES REMISES AU PIED DANS LA SCÈNE (lot A9 bis, cfg.remisesPied).
//
// Deux habillages, lus de la sim :
//   - LA COURSE D'ÉLAN : la sim arme le geste 'frappe' sur la DURÉE de la course (anticipation = le temps d'arriver au ballon,
//     étirée ou avancée à l'arrivée — referee.elanStep) ; le clip généré a SON heure de contact (~0,35 s). L'horloge du clip
//     se cale pour que son contact tombe sur celui de la sim : avant ce décalage, t < 0 — la couche tient sa première pose à
//     poids nul (Rondo.js : le haut du corps et les jambes restent à la foulée générée, le corps COURT), puis le geste monte
//     dans le dernier tiers de seconde ; au contact la sim frappe, le clip aussi.
//   - LE BALLON EN MAINS : le dégagement de volée porte le ballon aux gants jusqu'au lâcher (payload.lache posé par
//     keeper.gkHeldBall) — après, la sim le fait tomber et la scène le dessine où il est ; la PRISE AÉRIENNE tenue (dette A6) :
//     le ballon reste dans les gants du clip 'plongeonPrise' tant que le gardien le possède, au lieu de sauter au point de
//     tenue de la sim pendant que les bras sont encore en l'air.

/** L'heure d'échantillonnage du clip d'élan : le contact du clip sur le contact de la sim (t < 0 avant le départ du clip). */
export function remiseClock(pl, act, t) {
  if (act?.payload?.retard) return act.t - act.payload.retard;   // (A9 ter) le saut du mur : le retard de réaction est dans l'acte, le clip attend (t < 0 : la pose tenue)
  if (act?.payload?.kind !== 'elan') return t;
  return act.t - (act.anticipation - (pl.gestureLayer.spec?.contact ?? 0));
}

/** Le ballon suit les mains : la volée jusqu'au lâcher, la prise aérienne tenue tant qu'elle est possédée. */
export function remiseHands(pl, aT, stx, s) {
  if (aT?.payload?.mains === 'volee' && !aT.fired && aT.payload.lache == null) return true;
  return (pl.gestureLayer.spec?.name ?? '') === 'plongeonPrise' && stx.ball.owner === s.id && (s.down ?? 0) <= 0;
}

/** (A9 ter) LA SORTIE DE BUT LONGUE se dégage DANS L'IMAGE du contact d'élan : la sim arme sa passe (windup) dans la même image que
 *  l'événement 'élan' — l'armé est déjà joué par la course, la scène n'arme pas un second geste : le clip d'élan garde son
 *  accompagnement sur une horloge LOCALE (pl._elanTail : l'acte de passe qui suit a son t à 0, le clip ne rembobine pas). */
export function remiseSkip(scene, pl, e) {
  if (e.type !== 'windup' || e.skill || !pl?.gestureLayer?.active) return false;
  const ev = scene.state.events;
  let hit = false;
  for (let i = ev.length - 1; i >= 0 && ev[i].t >= e.t; i--) if (ev[i].type === 'élan' && ev[i].by === e.by && ev[i].remise === 'sortie-de-but') { hit = true; break; }
  if (!hit) return false;
  const spec = pl.gestureLayer.spec;
  pl._layerClock = { t0: scene._t - (spec?.contact ?? 0), offset: 0, dur: spec?.duration ?? 0.6, antic: spec?.contact ?? 0.2 };
  pl._elanTail = true;
  return true;
}
