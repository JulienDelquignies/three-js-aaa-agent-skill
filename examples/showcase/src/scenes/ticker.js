// ticker.js — LE TICKER DU MATCH : la présentation des événements nommés, famille extraite de
// Rondo.js au paiement de la dette de volumétrie (la scène a crevé le plafond commun de 1250
// lignes au fil des lots 104-111 pendant que verify-sync dormait HORS batterie — leçon : le
// banc de volumétrie rejoint la batterie de chaque lot). Présentation PURE : aucun état de
// jeu ne vit ici. Le FLASH central du sifflet (créé au montage — toute page qui monte la
// scène l'a d'office, le moteur porte sa lisibilité, lot 59) et le JOURNAL des gestes
// (l'élément #gestes si la page le donne ; né du retour « j'ai du mal à distinguer les
// feintes », NOTES 36 : l'intelligence invisible se nomme pour être jugeable).
// L'extraction a RÉVÉLÉ un doublon d'hier : deux branches 'carton' dont la seconde (ticker
// détaillé, jaune avec cumul) était MORTE — masquée par la première (sifflet seul) dans le
// même else-if. Fusionnées ici : le carton siffle ET s'inscrit au journal.
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function makeTicker(TEAMS) {
  const hud = typeof document !== 'undefined' ? document.getElementById('gestes') : null;
  const log = [];
  const flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;top:11%;left:50%;transform:translateX(-50%);padding:.3em .85em;'
    + 'font:700 clamp(18px,4vw,34px)/1.2 system-ui,sans-serif;letter-spacing:.08em;color:#fff;'
    + 'background:rgba(10,14,12,.74);border-left:.22em solid #f2c14e;border-radius:.3em;opacity:0;'
    + 'transition:opacity .25s;pointer-events:none;z-index:40;text-transform:uppercase;white-space:nowrap';
  document.body.appendChild(flash);
  let flashT = 0;
  const sifflet = (txt, couleur = '#f2c14e') => {
    flash.textContent = txt;
    flash.style.borderLeftColor = couleur;
    flash.style.opacity = '1';
    clearTimeout(flashT);
    flashT = setTimeout(() => { flash.style.opacity = '0'; }, 1600);
  };
  const pousse = (html) => {
    log.unshift(html);
    if (log.length > 5) log.pop();
    if (hud) hud.innerHTML = log.join('<br>');
  };
  const team = (state, id) => TEAMS[state.players[id]?.team ?? 0].name;

  /** Traite un événement de PRÉSENTATION ; rend true s'il en était un (les événements de
   *  gameplay — windup, control, touche… — restent le métier de la scène). */
  const event = (e, state) => {
    if (e.type === 'skill' && hud && !e.kind.endsWith('-vendu')) {
      // le ticker des gestes : l'événement du CONTACT (skillContactNow), pas l'intention —
      // les '*-vendu' sont le mordu du même geste. Les ESPÈCES se nomment (crochet court ≠
      // chaloupé, passement ×2, sortie) : la variété doit se lire.
      const names = { rateau: 'râteau', semelle: 'semelle', feinte: 'feinte de passe', passement: 'passement de jambes', crochet: 'crochet', frappeFeinte: 'feinte de frappe', doubleContact: 'double contact', petitPont: 'petit pont', roulette: 'roulette' };
      let label = names[e.kind] ?? e.kind;
      if (e.kind === 'crochet' && e.espece === 'crochetChaloupe') label = 'crochet chaloupé';
      else if (e.kind === 'crochet' && e.espece === 'crochetCourt') label = 'crochet court';
      else if (e.kind === 'passement') label = `passement${e.enCourse ? ' lancé' : ''}${(e.tours ?? 1) >= 2 ? ` ×${e.tours}` : ''}${e.sortie ? ` (${e.sortie})` : ''}`;
      else if (e.kind === 'petitPont' && e.reussi === false) label = 'petit pont (fermé)';
      pousse(`<b style="color:#e8ebf2">${label}</b> <span>— ${team(state, e.by)} nº${e.by} · ${mmss(e.t)}</span>`);
    } else if (e.type === 'tête' || e.type === 'volée') {
      // LE CIEL AU JOURNAL (lot 112) : le contact aérien est un geste comme un autre — la
      // tête qui SAUTE se distingue de la tête debout (la détente se lit), la volée nomme
      // sa reprise. Sans ces lignes le saut authoré resterait un mouvement anonyme.
      if (!hud) return true;
      const l = e.type === 'tête' ? `tête${e.saut ? ' (saut)' : ''} — ${e.mode}` : `volée — ${e.mode}${e.demi ? ' (demi)' : ''}`;
      pousse(`<b style="color:#e8ebf2">${l}</b> <span>— ${team(state, e.by)} nº${e.by} · ${mmss(e.t)}</span>`);
    } else if (e.type === 'shot' && e.kind === 'lob' && hud) {
      // LE LOB SE NOMME (lot 120) : le geste rare du gardien avancé puni — les tirs
      // ordinaires restent silencieux, le lob est un événement (comme les gestes, NOTES 36)
      pousse(`<b style="color:#f4a261">lob tenté</b> <span>— ${team(state, e.by)} nº${e.by} · ${mmss(e.t)}</span>`);
    } else if (e.type === 'un-deux' && hud) {
      // LE MUR SE LIT (lot 119) : donne-et-va — le passeur repart, la remise se prépare
      pousse(`<b style="color:#8ecae6">une-deux lancé</b> <span>— nº${e.a} avec nº${e.b} · ${mmss(e.t)}</span>`);
    } else if (e.type === 'celebration' && hud) {
      // LE BUT SE FÊTE (lot 116) : l'événement nomme le buteur et ses compagnons de course
      pousse(`<b style="color:#90be6d">il célèbre !</b> <span>— nº${e.by} et ${e.avec?.length ?? 0} coéquipiers · ${mmss(e.t)}</span>`);
    } else if (e.type === 'coach' && hud) {
      // LE COACH SE LIT (lot 113) : le changement de posture est une décision de banc —
      // sans cette ligne, un bloc qui monte « tout seul » à la 70e serait illisible.
      const noms = { pousse: 'le coach pousse', gere: 'le coach gère', recule: 'le bloc recule', base: 'retour au plan' };
      pousse(`<b style="color:#f4a261">${noms[e.posture] ?? e.posture}</b> <span>— ${TEAMS[e.team ?? 0].name} · ${mmss(e.t)}</span>`);
    } else if (e.type === 'press' && hud) {
      // la fenêtre de pressing se lit : l'intelligence off-ball est invisible par nature —
      // l'événement nommé la rend jugeable, exactement comme les gestes (NOTES 36).
      pousse(`<b style="color:#8ecae6">pressing</b> <span>— ${TEAMS[e.team ?? 0].name} (${(e.kind ?? '').replace(/-/g, ' ')}) · ${mmss(e.t)}</span>`);
    } else if (e.type === 'but') {
      sifflet('but !', '#90be6d');
    } else if (e.type === 'carton') {
      // Loi 12 discipline : le geste de l'arbitre siffle ET s'inscrit (jaune : la récidive
      // porte son cumul ; rouge : la couleur de l'objet).
      sifflet(`carton ${e.couleur}`, e.couleur === 'rouge' ? '#d62828' : '#f2c14e');
      pousse(e.couleur === 'rouge'
        ? `<b style="color:#d62828">carton rouge</b> <span>— nº${e.by} · ${mmss(e.t)}</span>`
        : `<b style="color:#ffd60a">carton jaune</b> <span>— nº${e.by} (${e.cumul}ᵉ) · ${mmss(e.t)}</span>`);
    } else if (e.type === 'mi-temps') {
      sifflet('mi-temps');
    } else if (e.type === 'fin-de-match') {
      sifflet('coup de sifflet final');
    } else if (e.type === 'hors-jeu') {
      // le sifflet se lit comme un geste : la Loi 11 est un événement de match, pas un
      // secret de simulation — sans ceci un coup franc « sorti de nulle part » serait un bug
      // aux yeux de l'utilisateur (le ticker est né de ce besoin).
      sifflet(`hors-jeu — nº${e.by}`);
      pousse(`<b style="color:#f2c14e">hors-jeu</b> <span>— ${team(state, e.by)} nº${e.by} · ${mmss(e.t)}</span>`);
    } else if (e.type === 'faute' || e.type === 'avantage') {
      // Loi 12 au ticker : la faute nomme le fautif, l'avantage nomme la décision — sans
      // ces lignes un coup franc (ou un jeu qui continue sur un tacle raté) serait illisible.
      if (e.type === 'faute') sifflet(`faute — nº${e.by}`, '#e76f51');
      pousse(e.type === 'faute'
        ? `<b style="color:#e76f51">faute</b> <span>— nº${e.by} sur nº${e.sur} · ${mmss(e.t)}</span>`
        : `<b style="color:#90be6d">avantage</b> <span>— ${team(state, e.sur)} joue · ${mmss(e.t)}</span>`);
    } else return false;
    return true;
  };
  return { hud, sifflet, event };
}
