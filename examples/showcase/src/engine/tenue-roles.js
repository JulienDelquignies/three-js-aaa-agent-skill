// tenue-roles.js — LE PRESSEUR ET LE COUVREUR GARDENT LEUR RÔLE (lot 389, cfg.tenueRoles — chantier du 02/10 : « fais la 1 », la stabilité
// des métiers près du ballon). Sondé (20 min) : une cible défensive à moins de 10 m du ballon y restait 0,87 s en médiane (p25 0,10 s), le
// corps n'y entrait qu'une fois sur deux ; les épisodes finissaient surtout chez le PRESSEUR (315 sur 1 674) et aux bascules de métier. Cause :
// l'élection (byDist : le plus proche de l'ancre presse, le second couvre) se refaisait à CHAQUE image — un écart de quelques centimètres
// permutait presseur, couvreur et marqueurs. La loi : tant que la même équipe a le ballon, le presseur d'hier (puis le couvreur d'hier) garde
// son rang s'il est debout et pas plus loin de l'ancre que le meilleur candidat de plus de `marge` m — × la consigne (pressing : la meute
// s'échange plus vite, × ax(pressing, 1,3, 0,7)) × la note décisions (le bon défenseur passe la main à temps : ÷ decF). Absente : hier, au bit.
const ax = (v, lo, hi) => lo + Math.max(0, Math.min(1, v ?? 0.5)) * (hi - lo);
export function tenirRoles(st, byDist, def, atk, K, tq) {
  const T = st._tenueR ??= [null, null], prev = T[def], seq = st._possChangeAt ?? 0;
  if (prev && prev.atk === atk && prev.seq === seq && byDist.length > 2) {
    for (const rang of [0, 1]) {
      const id = prev.ids[rang]; if (id == null) continue;
      const i = byDist.findIndex((q) => q.id === id); if (i <= rang || i < 0) continue;
      const q = byDist[i], best = byDist[rang]; if (q.down > 0) continue;
      const m = (K.marge ?? 3) * ax(tq?.pressing, 1.3, 0.7) / (q.skill?.decF ?? 1);
      if (q._dAnc <= best._dAnc + m) { byDist[i] = best; byDist[rang] = q; }
    }
  }
  T[def] = { atk, seq, ids: [byDist[0]?.id ?? null, byDist[1]?.id ?? null] };
}
