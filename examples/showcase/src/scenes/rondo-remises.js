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
  if (act?.payload?.kind !== 'elan') return t;
  return act.t - (act.anticipation - (pl.gestureLayer.spec?.contact ?? 0));
}

/** Le ballon suit les mains : la volée jusqu'au lâcher, la prise aérienne tenue tant qu'elle est possédée. */
export function remiseHands(pl, aT, stx, s) {
  if (aT?.payload?.mains === 'volee' && !aT.fired && aT.payload.lache == null) return true;
  return (pl.gestureLayer.spec?.name ?? '') === 'plongeonPrise' && stx.ball.owner === s.id && (s.down ?? 0) <= 0;
}
