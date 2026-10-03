import { TENUES, MOTIFS, MOTIFS_SHORT, MOTIFS_CHAUSSETTES, CHAUSSURES, EQUIPEMENT, TEINTES, GANTS_GARDIEN, conflit } from './gpf-maillots.js';
import { CARRURES, carrureDe } from './gpf-morphologie.js';
import { TEINTS, COULEURS_CHEVEUX, NOMS_COUPES, NOMS_PILOSITES, NOMS_ORIGINES } from './gpf-apparence.js';

// gpf-habillage.js — L'HABILLAGE TÉLÉ DE /match11 (lot L5 « L'image » ; EX-04 la régie, EX-38/42 les statistiques en direct). Du DOM
// par-dessus le canevas, rien dans la scène :
//   · le TABLEAU D'AFFICHAGE (en haut à gauche) : les deux équipes à leurs couleurs, le score, l'horloge du match, la mi-temps ; dessous, les
//     buteurs, et l'état de la lecture (EN DIRECT, PAUSE, ×4, RALENTI, DIFFÉRÉ) ;
//   · les BANDEAUX (le tiers bas) : le but (buteur, passeur, minute), les cartons, le penalty, la mi-temps et la fin ;
//   · la RÉGIE (en bas) : pause, vitesses ×½ à ×8 (le match ne change pas : le pas est fixe), le prochain temps fort, 10 s en arrière, la
//     caméra, les statistiques, les réglages ;
//   · le PANNEAU DES STATISTIQUES : la feuille de match du corps (gpf/cerveau.mjs → feuille.mjs : le rapport de stats.js) — le match, chaque
//     mi-temps, les joueurs et leurs notes, les moments (les buts se revoient) ;
//   · les RÉGLAGES : le stade, l'heure, le public, les ralentis automatiques, les ombres, le bloom, les infos techniques.
// Le clavier : Espace pause · 1-5 les vitesses · N le prochain temps fort · B 10 s en arrière · R revoir le dernier but · Échap passer le
// ralenti · C la caméra suivante · S les statistiques · H masquer l'habillage · D les infos techniques · M le radar · G / F le prochain geste,
// face-à-face. LE RADAR (les 22 et le ballon vus d'en haut : la forme des équipes pendant que la caméra suit le ballon) et LE NOM DU PORTEUR
// au-dessus de lui sont deux aides de visionnage (réglages).

const CSS = `
.gh { --fond: rgba(9,13,24,.86); --fond2: rgba(22,30,50,.92); --trait: rgba(255,255,255,.12); --texte: #eef1f7; --doux: #9aa4b8; --or: #ffd84d;
  font-family: 'Barlow Condensed', 'Roboto Condensed', 'Arial Narrow', system-ui, sans-serif; color: var(--texte); }
.gh button { font: inherit; color: inherit; cursor: pointer; }
.gh-sb { position: fixed; left: 14px; top: 14px; z-index: 30; display: flex; align-items: stretch; height: 36px; border-radius: 7px; overflow: hidden;
  box-shadow: 0 6px 18px rgba(0,0,0,.35); font-weight: 700; font-size: 20px; letter-spacing: .02em; user-select: none; }
.gh-sb .eq { display: flex; align-items: center; gap: 8px; padding: 0 12px; background: var(--fond); }
.gh-sb .eq i { width: 6px; height: 22px; border-radius: 2px; display: block; box-shadow: inset 0 0 0 1px rgba(255,255,255,.25); }
.gh-sb .eq.d { flex-direction: row-reverse; }
.gh-sb .sc { display: flex; align-items: center; gap: 7px; padding: 0 12px; background: #f4f6fb; color: #0b1020; font-variant-numeric: tabular-nums; font-size: 22px; }
.gh-sb .sc.flash { animation: ghFlash 1.2s ease-out 3; }
@keyframes ghFlash { 0% { background: var(--or); } 100% { background: #f4f6fb; } }
.gh-sb .tm { display: flex; align-items: center; padding: 0 12px; background: var(--fond2); font-variant-numeric: tabular-nums; min-width: 78px; justify-content: center; }
.gh-etat { position: fixed; left: 14px; top: 54px; z-index: 30; display: flex; gap: 6px; align-items: center; font-weight: 600; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; }
.gh-etat span { padding: 3px 8px; border-radius: 4px; background: var(--fond); }
.gh-etat .live { background: #c8202f; } .gh-etat .rec { background: #2b6fd6; } .gh-etat .pause { background: #6b7280; } .gh-etat .vit { background: #1f8a5a; }
.gh-buteurs { position: fixed; left: 14px; top: 82px; z-index: 30; font-size: 14px; font-weight: 500; color: #c9d1e0; max-width: 46vw; line-height: 1.4;
  background: var(--fond); padding: 3px 9px; border-radius: 5px; }
.gh-buteurs:empty { display: none; }
.gh-buteurs b { color: var(--texte); font-weight: 600; }
.gh-info { position: fixed; left: 14px; bottom: 70px; z-index: 30; font-size: 16px; font-weight: 600; padding: 5px 10px; border-radius: 6px; background: var(--fond);
  border-left: 3px solid var(--or); max-width: calc(100vw - 28px); display: none; }
.gh-info.on { display: block; }
.gh-bandeau { position: fixed; left: 50%; bottom: 78px; z-index: 31; transform: translate(-50%, 20px); opacity: 0; transition: opacity .35s, transform .35s; width: max-content;
  display: flex; align-items: stretch; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 28px rgba(0,0,0,.45); pointer-events: none; max-width: calc(100vw - 24px); }
.gh-bandeau.on { opacity: 1; transform: translate(-50%, 0); }
.gh-bandeau .ty { display: flex; align-items: center; padding: 0 16px; font-weight: 800; font-size: 26px; letter-spacing: .04em; background: var(--or); color: #10131c; white-space: nowrap; }
.gh-bandeau .ty.jaune { background: #f5c518; } .gh-bandeau .ty.rouge { background: #d3202f; color: #fff; } .gh-bandeau .ty.info { background: #f4f6fb; }
.gh-bandeau .tx { padding: 8px 16px; background: var(--fond); min-width: 220px; }
.gh-bandeau .tx b { display: block; font-size: 22px; font-weight: 700; }
.gh-bandeau .tx span { display: block; font-size: 15px; color: var(--doux); }
.gh-regie { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 32; display: flex; gap: 6px; align-items: center; padding: 6px; width: max-content;
  border-radius: 10px; background: var(--fond); border: 1px solid var(--trait); box-shadow: 0 8px 22px rgba(0,0,0,.35); flex-wrap: wrap; justify-content: center;
  max-width: calc(100vw - 16px); }
.gh-regie button, .gh-regie select { background: rgba(255,255,255,.06); border: 1px solid var(--trait); border-radius: 7px; padding: 6px 10px; font-size: 15px; font-weight: 600; color: var(--texte); }
.gh-regie select { font-family: inherit; }
.gh-regie button:hover { background: rgba(255,255,255,.14); }
.gh-regie button.on { background: #f4f6fb; color: #0b1020; }
.gh-regie .grp { display: flex; gap: 2px; }
.gh-regie .grp button { border-radius: 0; padding: 6px 8px; } .gh-regie .grp button:first-child { border-radius: 7px 0 0 7px; } .gh-regie .grp button:last-child { border-radius: 0 7px 7px 0; }
.gh-regie .passer { background: var(--or); color: #10131c; display: none; } .gh-regie .passer.on { display: inline-block; }
.gh-panneau { position: fixed; right: 0; top: 0; bottom: 0; width: min(440px, 100vw); z-index: 40; background: rgba(8,12,22,.95); border-left: 1px solid var(--trait);
  transform: translateX(105%); transition: transform .3s; display: flex; flex-direction: column; box-shadow: -10px 0 30px rgba(0,0,0,.4); }
.gh-panneau.on { transform: translateX(0); }
.gh-panneau header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 8px; }
.gh-panneau header h2 { font-size: 22px; font-weight: 700; margin: 0; }
.gh-panneau header button { background: none; border: 0; font-size: 22px; color: var(--doux); }
.gh-onglets { display: flex; gap: 4px; padding: 0 12px 8px; flex-wrap: wrap; }
.gh-onglets button { background: rgba(255,255,255,.06); border: 1px solid var(--trait); border-radius: 6px; padding: 4px 9px; font-size: 14px; font-weight: 600; color: var(--doux); }
.gh-onglets button.on { background: #f4f6fb; color: #0b1020; }
.gh-corps { overflow-y: auto; padding: 4px 14px 18px; flex: 1; font-size: 15px; }
.gh-tete { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; margin: 4px 0 12px; font-weight: 700; font-size: 18px; }
.gh-tete .g { text-align: left; } .gh-tete .d { text-align: right; } .gh-tete .s { font-size: 30px; font-variant-numeric: tabular-nums; }
.gh-tete i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin: 0 6px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.3); }
.gh-ligne { display: grid; grid-template-columns: 56px 1fr 56px; align-items: center; gap: 8px; margin: 7px 0; }
.gh-ligne .v { font-weight: 700; font-size: 17px; font-variant-numeric: tabular-nums; } .gh-ligne .v.d { text-align: right; }
.gh-ligne .lb { text-align: center; color: var(--doux); font-size: 14px; }
.gh-barre { grid-column: 1 / 4; display: flex; height: 5px; gap: 3px; margin-top: -3px; }
.gh-barre div { height: 100%; border-radius: 3px; }
.gh-sous { margin: 16px 0 6px; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: var(--doux); font-weight: 600; }
.gh-table { width: 100%; border-collapse: collapse; font-size: 14px; font-variant-numeric: tabular-nums; }
.gh-table th { text-align: right; color: var(--doux); font-weight: 600; padding: 3px 4px; border-bottom: 1px solid var(--trait); font-size: 12px; }
.gh-table td { text-align: right; padding: 3px 4px; border-bottom: 1px solid rgba(255,255,255,.05); }
.gh-table th:nth-child(-n+2), .gh-table td:nth-child(-n+2) { text-align: left; }
.gh-table td.n { font-weight: 700; } .gh-table tr.hdm td { color: var(--or); }
.gh-note { display: inline-block; min-width: 30px; text-align: center; border-radius: 4px; padding: 0 4px; color: #0b1020; font-weight: 700; }
.gh-moment { display: grid; grid-template-columns: 38px 22px 1fr auto; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,.06); }
.gh-moment .mn { font-weight: 700; color: var(--doux); text-align: right; } .gh-moment small { color: var(--doux); display: block; }
.gh-moment button { background: rgba(255,255,255,.08); border: 1px solid var(--trait); border-radius: 6px; padding: 3px 8px; font-size: 13px; }
.gh-carte { display: inline-block; width: 11px; height: 15px; border-radius: 2px; } .gh-carte.jaune { background: #f5c518; } .gh-carte.rouge { background: #d3202f; }
.gh-reglages label { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.06); }
.gh-reglages select { background: #141b2c; color: var(--texte); border: 1px solid var(--trait); border-radius: 6px; padding: 4px 6px; font: inherit; }
.gh-reglages p { color: var(--doux); font-size: 14px; line-height: 1.4; }
.gh-reglages code { overflow-wrap: anywhere; }   /* (une longue valeur d'adresse débordait du panneau) */
.gh-reglages input[type=color] { width: 34px; height: 26px; border: 1px solid var(--trait); border-radius: 5px; background: none; padding: 0; }
.gh-reglages kbd { background: rgba(255,255,255,.1); border-radius: 4px; padding: 0 5px; font-family: inherit; }
.gh-radar { position: fixed; right: 14px; bottom: 78px; z-index: 30; border-radius: 8px; background: rgba(9,13,24,.72); border: 1px solid var(--trait); padding: 5px; }
.gh-radar canvas { display: block; width: 232px; height: 152px; }
.gh-porteur { position: fixed; left: 0; top: 0; z-index: 29; pointer-events: none; transform: translate(-50%, -100%); font-weight: 700; font-size: 15px;
  padding: 1px 7px; border-radius: 4px; background: rgba(9,13,24,.78); white-space: nowrap; border-bottom: 2px solid #fff; display: none; }
.gh-porteur.on { display: block; }
.gh-masque .gh-radar, .gh-masque .gh-porteur { display: none !important; }
.gh-masque .gh-sb, .gh-masque .gh-etat, .gh-masque .gh-buteurs, .gh-masque .gh-regie, .gh-masque .gh-bandeau, .gh-masque .gh-info { display: none !important; }
@media (max-width: 640px) {
  .gh-sb { left: 8px; top: 8px; height: 30px; font-size: 16px; } .gh-sb .sc { font-size: 18px; padding: 0 9px; } .gh-sb .eq { padding: 0 8px; gap: 5px; } .gh-sb .tm { min-width: 62px; padding: 0 8px; }
  .gh-etat { left: 8px; top: 42px; font-size: 11px; } .gh-buteurs { left: 8px; top: 64px; font-size: 12px; max-width: 70vw; }
  .gh-regie { bottom: 8px; gap: 4px; padding: 4px; } .gh-regie button, .gh-regie select { padding: 5px 7px; font-size: 13px; } .gh-regie .grp button { padding: 5px 6px; }
  .gh-regie .lg { display: none; }
  .gh-radar { right: 8px; bottom: 104px; padding: 3px; } .gh-radar canvas { width: 150px; height: 98px; }
  .gh-info { left: 8px; bottom: 104px; font-size: 13px; }
  .gh-bandeau { bottom: 112px; } .gh-bandeau .ty { font-size: 19px; padding: 0 10px; } .gh-bandeau .tx { min-width: 0; padding: 6px 10px; } .gh-bandeau .tx b { font-size: 17px; } .gh-bandeau .tx span { font-size: 13px; }
}`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const css = (hex) => `#${(hex >>> 0).toString(16).padStart(6, '0')}`;
/** L'horloge du match, comme à la télé : 67:12 ; après 90:00, « 90:00 » figé. */
export const horloge = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const couleurNote = (n) => (n == null ? '#4b5563' : n >= 8 ? '#3ddc84' : n >= 7 ? '#a3e635' : n >= 6 ? '#facc15' : n >= 5 ? '#fb923c' : '#f87171');

export const VITESSES = [0.5, 1, 2, 4, 8];
/** L'ordre des postes sur la feuille : ceux du corps (feuille.mjs ROLES) et ceux du cerveau (formation.js : D(D), DM(C), AM(G), ST(C)…). */
const ORDRE_POSTES = [/^DD$|^D\(D\)|^WB\(D\)/, /^DC$|^D\(C\)/, /^DG$|^D\(G\)|^WB\(G\)/, /^MDC$|^DM/, /^MD$|^M\(D\)/, /^MC$|^M\(C\)/, /^MG$|^M\(G\)/, /^MOC$|^AM\(C\)/, /^AM\(D\)/, /^AM\(G\)/, /^BU$|^ST/];
export const PLANS = { auto: 'Auto (réalisateur)', tele: 'Télé', rapprochee: 'Rapprochée', tactique: 'Tactique', joueur: 'Joueur', but: 'Derrière le but', portrait: 'Portrait (le joueur choisi)' };

export class Habillage {
  /**
   * @param {object} m la scène GpfMatch (ses actions et ce qu'elle affiche)
   * @param {{ equipes: {nom:string, court:string, primary:number, secondary:number}[], stades: object, heures: object }} o
   */
  constructor(m, { equipes, stades, heures }) {
    this.m = m; this.E = equipes; this.stades = stades; this.heures = heures;
    this.panneau = null; this.onglet = 'match'; this._rafraichi = 0; this._cle = '';
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const racine = this.racine = document.createElement('div'); racine.className = 'gh hud'; document.body.appendChild(racine);
    const [A, B] = equipes;
    racine.innerHTML = `
      <div class="gh-sb"><div class="eq g"><i data-pastille="0" style="background:${css(A.primary)}"></i><span>${esc(A.court)}</span></div>
        <div class="sc"><b data-s="0">0</b><span>-</span><b data-s="1">0</b></div>
        <div class="eq d"><i data-pastille="1" style="background:${css(B.primary)}"></i><span>${esc(B.court)}</span></div><div class="tm">00:00</div></div>
      <div class="gh-etat"></div>
      <div class="gh-buteurs"></div>
      <div class="gh-info"></div>
      <div class="gh-radar" title="Le radar : les 22 et le ballon, vus d'en haut (M)"><canvas width="464" height="304"></canvas></div>
      <div class="gh-porteur"></div>
      <div class="gh-bandeau"><div class="ty"></div><div class="tx"><b></b><span></span></div></div>
      <div class="gh-regie">
        <button data-a="pause" title="Pause (Espace)">⏸</button>
        <div class="grp">${VITESSES.map((v) => `<button data-v="${v}" title="Vitesse ×${v} (le match ne change pas)">×${v === 0.5 ? '½' : v}</button>`).join('')}</div>
        <button data-a="recul" title="10 secondes en arrière (B)">⟲ 10 s</button>
        <button data-a="tempsFort" title="Avancer jusqu’au prochain temps fort — tir, but, carton — et le montrer (N)">Temps fort ⏭</button>
        <button data-a="geste" class="lg" title="Avancer jusqu’au prochain geste en course (G)">Geste ⏭</button>
        <button data-a="passer" class="passer" title="Revenir au direct (Échap)">Direct ⏭</button>
        <select data-a="plan" title="La caméra (C)">${Object.entries(PLANS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <button data-a="stats" title="Statistiques (S)">Stats</button>
        <button data-a="reglages" title="Réglages">⚙</button>
      </div>
      <aside class="gh-panneau"><header><h2></h2><button data-a="fermer" title="Fermer">✕</button></header><div class="gh-onglets"></div><div class="gh-corps"></div></aside>`;
    this.$ = (s) => racine.querySelector(s);
    this.sc = [this.$('[data-s="0"]'), this.$('[data-s="1"]')]; this.tm = this.$('.gh-sb .tm'); this.scBox = this.$('.gh-sb .sc');
    this.etat = this.$('.gh-etat'); this.buteurs = this.$('.gh-buteurs'); this.bandeau = this.$('.gh-bandeau'); this.infoEl = this.$('.gh-info');
    this.pan = this.$('.gh-panneau');
    this.radarBox = this.$('.gh-radar'); this.radarCv = this.$('.gh-radar canvas'); this.radar2d = this.radarCv.getContext('2d'); this.porteurEl = this.$('.gh-porteur');
    this.radarBox.style.display = m.reglages.radar ? 'block' : 'none';
    racine.addEventListener('click', (e) => this._clic(e));
    racine.addEventListener('change', (e) => this._change(e));
    addEventListener('keydown', (e) => this._touche(e));
    this._scores = [0, 0]; this._etatCle = '';
  }

  // ———————————————————————————— chaque image ————————————————————————————
  maj(dt) {
    const m = this.m, a = m.affiche; if (!a) return;
    for (let k = 0; k < 2; k++) if (a.score[k] !== this._scores[k]) { this.sc[k].textContent = a.score[k]; if (a.score[k] > this._scores[k]) { this.scBox.classList.remove('flash'); void this.scBox.offsetWidth; this.scBox.classList.add('flash'); } this._scores[k] = a.score[k]; }
    const tm = a.per === 3 ? 'FIN' : horloge(a.t); if (tm !== this._tm) { this.tm.textContent = tm; this._tm = tm; }
    // l'état de la lecture et la mi-temps
    const per = a.per === 3 ? 'Fin du match' : a.per === 2 ? '2e mi-temps' : '1re mi-temps';
    const lec = a.lecture ? `<span class="rec">${esc(a.lecture)}</span>` : a.saut ? `<span class="vit">${esc(a.saut)}</span>` : m.pause ? '<span class="pause">Pause</span>' : a.per === 3 ? '' : '<span class="live">● Direct</span>';
    const vit = !a.lecture && !a.saut && m.vitesse !== 1 ? `<span class="vit">×${m.vitesse === 0.5 ? '½' : m.vitesse}</span>` : '';
    const cle = per + lec + vit; if (cle !== this._etatCle) { this.etat.innerHTML = `<span>${per}</span>${lec}${vit}`; this._etatCle = cle; }
    // la régie : l'état des boutons
    const rc = `${m.pause}|${m.vitesse}|${!!a.lecture}|${m.plan}`;
    if (rc !== this._regieCle) {
      this._regieCle = rc;
      this.$('[data-a="pause"]').textContent = m.pause ? '▶' : '⏸';
      for (const b of this.racine.querySelectorAll('[data-v]')) b.classList.toggle('on', Number(b.dataset.v) === m.vitesse);
      this.$('[data-a="passer"]').classList.toggle('on', !!a.lecture);
      const sel = this.$('[data-a="plan"]'); if (sel.value !== m.plan) sel.value = m.plan;
    }
    // les buteurs (sous le tableau), quand la chronologie change
    const chrono = m.feuille?.chronologie?.() ?? [];
    const k = chrono.length; if (k !== this._nChrono) { this._nChrono = k; this._buteurs(chrono); }
    // le radar (les 22 et le ballon, vus d'en haut) et le nom du porteur au-dessus de lui
    if (m.reglages.radar) this._radar(m.radar());
    const pt = m.reglages.noms ? m.porteurEcran() : null;
    if (pt) {
      if (pt.nom !== this._ptNom) { this._ptNom = pt.nom; this.porteurEl.textContent = pt.nom; this.porteurEl.style.borderBottomColor = css(this.E[pt.equipe].primary); }
      this.porteurEl.style.left = `${pt.x}px`; this.porteurEl.style.top = `${pt.y}px`; this.porteurEl.classList.add('on');
    } else this.porteurEl.classList.remove('on');
    // le bandeau
    if (this._bandeauFin != null && performance.now() > this._bandeauFin) { this.bandeau.classList.remove('on'); this._bandeauFin = null; }
    // le panneau ouvert se rafraîchit toutes les 2 s (le rapport complet : quelques ms)
    if (this.panneau === 'stats' && performance.now() - this._rafraichi > 2000) this._rendreStats();
  }

  /** Le radar : le terrain (110 × 72) à l'échelle du canevas, les joueurs aux couleurs de leur équipe (les gardiens à la leur), le ballon. */
  _radar(R) {
    if (!R) return;
    const g = this.radar2d, W = this.radarCv.width, H = this.radarCv.height, kx = W / 116, kz = H / 78, X = (x) => W / 2 + x * kx, Z = (z) => H / 2 + z * kz;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(46,110,52,.55)'; g.fillRect(X(-55), Z(-36), 110 * kx, 72 * kz);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2;
    g.strokeRect(X(-55), Z(-36), 110 * kx, 72 * kz);
    g.beginPath(); g.moveTo(X(0), Z(-36)); g.lineTo(X(0), Z(36)); g.stroke();
    g.beginPath(); g.arc(X(0), Z(0), 9.15 * kx, 0, 7); g.stroke();
    for (const sx of [-1, 1]) { g.strokeRect(sx < 0 ? X(-55) : X(55 - 16.5), Z(-20.16), 16.5 * kx, 40.32 * kz); g.strokeRect(sx < 0 ? X(-56.5) : X(55), Z(-3.66), 1.5 * kx, 7.32 * kz); }
    for (const p of R.joueurs) {
      if (!p.visible) continue;
      g.beginPath(); g.arc(X(p.x), Z(p.z), p.porteur ? 9 : 7, 0, 7);
      g.fillStyle = p.gardien ? (p.equipe === 0 ? '#f5cc29' : '#4cc761') : css(this.E[p.equipe].primary); g.fill();
      g.lineWidth = p.porteur ? 3 : 2; g.strokeStyle = p.porteur ? '#ffd84d' : p.equipe === 0 ? '#15161a' : '#0d3550'; g.stroke();
    }
    g.beginPath(); g.arc(X(R.ballon.x), Z(R.ballon.z), 5, 0, 7); g.fillStyle = '#ff8a1f'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#fff'; g.stroke();
  }

  _buteurs(chrono) {
    const parts = [0, 1].map((t) => chrono.filter((f) => f.k === 'but' && f.team === t).map((f) => `${esc(this._nomCourt(f.by))} ${f.minute}'${f.csc ? ' (csc)' : f.penalty ? ' (pen.)' : ''}`));
    const rouges = chrono.filter((f) => f.k === 'carton' && f.couleur === 'rouge').map((f) => `<span class="gh-carte rouge"></span> ${esc(this._nomCourt(f.by))}`);
    this.buteurs.innerHTML = [parts[0].length ? `<b>${esc(this.E[0].court)}</b> ${parts[0].join(', ')}` : '', parts[1].length ? `<b>${esc(this.E[1].court)}</b> ${parts[1].join(', ')}` : '', rouges.join(' ')].filter(Boolean).join('<br>');
  }
  _nomCourt(id) { const n = this.m.feuille?.nom(id) ?? '?'; return n.replace(/^[A-Z]\.\s*/, ''); }

  /** Les couleurs des équipes ont changé (les maillots) : les pastilles du tableau, le panneau ouvert. */
  couleurs() {
    for (const i of this.racine.querySelectorAll('[data-pastille]')) { const E = this.E[Number(i.dataset.pastille)]; i.style.background = css(E.primary); i.style.boxShadow = `inset 0 0 0 2px ${css(E.secondary)}`; }
    if (this.panneau === 'stats') this._rendreStats(true);
  }

  /** La ligne du geste (en bas à gauche) : ce que le cerveau fait jouer au corps — vide : masquée. */
  info(texte) { if (texte === this._info) return; this._info = texte; this.infoEl.textContent = texte; this.infoEl.classList.toggle('on', !!texte); }

  // ———————————————————————————— les bandeaux ————————————————————————————
  annonce(type, titre, sous = '', { classe = '', duree = 5 } = {}) {
    const ty = this.bandeau.querySelector('.ty'); ty.textContent = type; ty.className = `ty ${classe}`;
    this.bandeau.querySelector('.tx b').textContent = titre; this.bandeau.querySelector('.tx span').textContent = sous;
    this.bandeau.classList.add('on'); this._bandeauFin = performance.now() + duree * 1000;
  }
  but(f, score) {
    const E = this.E[f.team], nom = f.by != null ? this.m.feuille?.nom(f.by) ?? '' : '';
    const sous = [f.passeur != null ? `passe de ${this.m.feuille?.nom(f.passeur)}` : f.csc ? 'contre son camp' : f.penalty ? 'sur penalty' : '', `${this.E[0].court} ${score[0]}-${score[1]} ${this.E[1].court}`].filter(Boolean).join(' · ');
    this.annonce('BUT !', `${nom || E.nom} · ${f.minute}'`, `${E.nom} — ${sous}`, { duree: 7 });
  }
  carton(f) {
    const E = this.E[f.team];
    this.annonce(f.couleur === 'rouge' ? (f.deuxJaunes ? '2E JAUNE' : 'ROUGE') : 'JAUNE', `${this.m.feuille?.nom(f.by) ?? ''} · ${f.minute}'`, E.nom, { classe: f.couleur, duree: 4.5 });
  }

  // ———————————————————————————— le panneau ————————————————————————————
  ouvrir(quoi) {
    if (this.panneau === quoi) return this.fermer();
    this.panneau = quoi; this.pan.classList.add('on');
    if (quoi === 'stats') this._rendreStats(true); else this._rendreReglages();
  }
  fermer() { this.panneau = null; this.pan.classList.remove('on'); }

  _rendreStats(neuf = false) {
    this._rafraichi = performance.now();
    const m = this.m, F = m.feuille, [A, B] = this.E, a = m.affiche;
    this.pan.querySelector('h2').textContent = 'Statistiques';
    const onglets = [['match', 'Match'], ['1', '1re MT'], ['2', '2e MT'], ['joueurs', 'Joueurs'], ['moments', 'Moments']];
    const ong = this.pan.querySelector('.gh-onglets');
    const oc = onglets.map(([k]) => k).join() + this.onglet;
    if (neuf || ong.dataset.cle !== oc) { ong.dataset.cle = oc; ong.innerHTML = onglets.map(([k, v]) => `<button data-o="${k}" class="${k === this.onglet ? 'on' : ''}">${v}</button>`).join(''); }
    const corps = this.pan.querySelector('.gh-corps');
    if (!F) { corps.innerHTML = '<p style="color:var(--doux)">Les statistiques viennent du journal de notre cerveau : elles ne sont pas disponibles en mode « leur IA » (?ia).</p>'; return; }
    const tete = `<div class="gh-tete"><div class="g"><i style="background:${css(A.primary)}"></i>${esc(A.nom)}</div><div class="s">${a.score[0]} - ${a.score[1]}</div><div class="d">${esc(B.nom)}<i style="background:${css(B.primary)}"></i></div></div>`;
    const scroll = corps.scrollTop;
    if (this.onglet === 'moments') { corps.innerHTML = tete + this._moments(F); corps.scrollTop = scroll; return; }
    const R = F.rapport({ per: this.onglet === '1' ? 1 : this.onglet === '2' ? 2 : null });
    corps.innerHTML = tete + (this.onglet === 'joueurs' ? this._joueurs(R) : this._equipes(R));
    corps.scrollTop = scroll;
  }

  _equipes(R) {
    const [e0, e1] = R.equipes, [A, B] = this.E, km = [0, 1].map((t) => R.joueurs.filter((j) => j.team === t).reduce((s, j) => s + (j.distance ?? 0), 0) / 1000);
    const sp = [0, 1].map((t) => R.joueurs.filter((j) => j.team === t).reduce((s, j) => s + (j.sprints ?? 0), 0));
    const ligne = (lb, a, b, { fmt = (v) => v ?? '–', pct = false } = {}) => {
      const va = Number(a) || 0, vb = Number(b) || 0, s = va + vb;
      const wa = pct ? va : s ? (100 * va) / s : 50, wb = pct ? vb : s ? (100 * vb) / s : 50;
      return `<div class="gh-ligne"><div class="v">${fmt(a)}</div><div class="lb">${lb}</div><div class="v d">${fmt(b)}</div>
        <div class="gh-barre"><div style="width:${wa}%;background:${css(A.primary)}"></div><div style="width:${wb}%;background:${css(B.primary)}"></div></div></div>`;
    };
    const p = (v) => (v == null ? '–' : `${Math.round(v)} %`), x2 = (v) => (v == null ? '–' : v.toFixed(2)), x1 = (v) => v.toFixed(1);
    return [
      ligne('Possession', e0.possession, e1.possession, { fmt: p, pct: true }),
      ligne('xG (buts attendus)', e0.xg, e1.xg, { fmt: x2 }),
      ligne('Tirs', e0.tirs, e1.tirs), ligne('Tirs cadrés', e0.cadres, e1.cadres), ligne('Tirs contrés', e0.contres, e1.contres), ligne('Arrêts du gardien', e0.arrets, e1.arrets),
      `<div class="gh-sous">Le ballon</div>`,
      ligne('Passes', e0.passes, e1.passes), ligne('Passes réussies', e0.reussite, e1.reussite, { fmt: p, pct: true }), ligne('Passes clés', e0.passesCles, e1.passesCles),
      ligne('Passes dans le dernier tiers', e0.dernierTiers, e1.dernierTiers), ligne('Dribbles (réussis)', e0.dribblesReussis, e1.dribblesReussis, { fmt: (v) => v ?? 0 }),
      `<div class="gh-sous">Sans le ballon</div>`,
      ligne('Récupérations', e0.recuperations, e1.recuperations), ligne('Interceptions', e0.interceptions, e1.interceptions), ligne('Tacles gagnés', e0.taclesGagnes, e1.taclesGagnes),
      ligne('Hauteur du bloc (m)', e0.hauteurBloc, e1.hauteurBloc, { fmt: (v) => (v == null ? '–' : Math.round(v)) }),
      `<div class="gh-sous">Discipline et arrêts de jeu</div>`,
      ligne('Fautes', e0.fautes, e1.fautes), ligne('Cartons jaunes', e0.jaunes, e1.jaunes), ligne('Cartons rouges', e0.rouges, e1.rouges), ligne('Corners', e0.corners, e1.corners), ligne('Hors-jeu', e0.horsJeu, e1.horsJeu),
      `<div class="gh-sous">Le physique</div>`,
      ligne('Distance (km)', km[0], km[1], { fmt: x1 }), ligne('Sprints', sp[0], sp[1]),
    ].join('');
  }

  _joueurs(R) {
    const hdm = R.joueurs.filter((j) => j.note != null).sort((a, b) => b.note - a.note)[0];
    // l'ordre d'une feuille de match : le gardien, la défense de droite à gauche, le milieu, l'attaque (les postes du corps, ou ceux du cerveau)
    const rang = (j) => { if (j.keeper) return 0; const p = String(j.post ?? ''); const i = ORDRE_POSTES.findIndex((re) => re.test(p)); return i < 0 ? 50 : i + 1; };
    const table = (t) => {
      const J = R.joueurs.filter((j) => j.team === t).sort((a, b) => rang(a) - rang(b));
      return `<div class="gh-sous"><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${css(this.E[t].primary)};margin-right:6px"></i>${esc(this.E[t].nom)}</div>
      <table class="gh-table"><tr><th>Poste</th><th>Joueur</th><th>Note</th><th>B</th><th>PD</th><th>Tirs</th><th>Passes</th><th>Drib.</th><th>Récup.</th><th>km</th></tr>
      ${J.map((j) => `<tr class="${j === hdm ? 'hdm' : ''}"><td>${esc(j.post ?? '')}</td><td class="n">${esc(j.name ?? '')}${j === hdm ? ' ★' : ''}${j.rouges ? ' <span class="gh-carte rouge"></span>' : j.jaunes ? ' <span class="gh-carte jaune"></span>' : ''}</td>
        <td><span class="gh-note" style="background:${couleurNote(j.note)}">${j.note ?? '–'}</span></td><td>${j.buts || ''}</td><td>${j.passesDecisives || ''}</td><td>${j.tirs || ''}</td>
        <td>${j.passes ? `${j.passesReussies}/${j.passes}` : ''}</td><td>${j.dribbles ? `${j.dribblesReussis}/${j.dribbles}` : ''}</td><td>${j.recuperations || ''}</td><td>${(j.distance / 1000).toFixed(1)}</td></tr>`).join('')}</table>`;
    };
    return (hdm ? `<p style="margin:0 0 6px;color:var(--doux)">Homme du match : <b style="color:var(--or)">${esc(hdm.name)}</b> (${esc(this.E[hdm.team].court)}, ${hdm.note})</p>` : '') + table(0) + table(1)
      + '<p style="color:var(--doux);font-size:13px;margin-top:12px">Note sur 10 (départ 6,0 : buts, passes décisives et clés, xG, réussite des passes, dribbles, actions défensives, discipline ; le gardien par ses arrêts). B buts · PD passes décisives · Drib. dribbles réussis / tentés (les gestes du cerveau).</p>';
  }

  _moments(F) {
    const c = F.chronologie();
    if (!c.length) return '<p style="color:var(--doux)">Pas encore de but ni de carton.</p>';
    return c.map((f, i) => {
      const E = this.E[f.team] ?? this.E[0];
      if (f.k === 'but') {
        const n = c.slice(0, i + 1).filter((x) => x.k === 'but').length - 1, clip = this.m.clips?.[n];
        return `<div class="gh-moment"><div class="mn">${f.minute}'</div><div>⚽</div><div><b>${esc(F.nom(f.by))}</b> <small>${esc(E.nom)}${f.csc ? ' · contre son camp' : ''}${f.penalty ? ' · penalty' : ''}${f.passeur != null ? ` · passe de ${esc(F.nom(f.passeur))}` : ''}</small></div>${clip ? `<button data-revoir="${n}">Revoir ▶</button>` : '<span></span>'}</div>`;
      }
      return `<div class="gh-moment"><div class="mn">${f.minute}'</div><div><span class="gh-carte ${f.couleur}"></span></div><div><b>${esc(F.nom(f.by))}</b> <small>${esc(E.nom)}${f.deuxJaunes ? ' · second jaune' : ''}</small></div><span></span></div>`;
    }).join('');
  }

  _rendreReglages() {
    const m = this.m;
    this.pan.querySelector('h2').textContent = 'Réglages';
    this.pan.querySelector('.gh-onglets').innerHTML = '';
    const opt = (o, v) => Object.entries(o).map(([k, x]) => `<option value="${k}" ${String(k) === String(v) ? 'selected' : ''}>${esc(x.nom ?? x)}</option>`).join('');
    const coche = (cle, val, lib) => `<label>${lib}<input type="checkbox" data-r="${cle}" ${val ? 'checked' : ''}></label>`;
    const corps = this.pan.querySelector('.gh-corps'), defile = corps.scrollTop;   // un réglage changé ne ramène pas en haut du panneau
    corps.innerHTML = `<div class="gh-reglages">
      <label>Stade<select data-r="stade">${opt(this.stades, m.reglages.stade)}</select></label>
      <label>Heure<select data-r="heure">${opt(this.heures, m.reglages.heure)}</select></label>
      ${coche('foule', m.reglages.foule, 'Le public')}
      ${coche('ralentis', m.reglages.ralentis, 'Les ralentis des buts')}
      ${coche('ombres', m.reglages.ombres, 'Les ombres')}
      ${coche('bloom', m.reglages.bloom, 'Le halo des lumières (bloom)')}
      ${coche('radar', m.reglages.radar, 'Le radar (les 22 vus d’en haut)')}
      ${coche('noms', m.reglages.noms, 'Le nom du porteur au-dessus de lui')}
      ${coche('technique', m.reglages.technique, 'Les infos techniques (images/s, calcul)')}
      ${this._reglagesMaillots()}
      <p>Le stade et l’heure se changent en plein match : la partie continue. La vitesse ne change pas le match (le pas du corps est fixe) ; les ralentis et le différé le mettent en attente.</p>
      <p><kbd>Espace</kbd> pause · <kbd>1</kbd>-<kbd>5</kbd> vitesses · <kbd>N</kbd> prochain temps fort · <kbd>B</kbd> 10 s en arrière · <kbd>R</kbd> revoir le dernier but · <kbd>Échap</kbd> retour au direct · <kbd>C</kbd> caméra · <kbd>S</kbd> stats · <kbd>H</kbd> masquer l’habillage · <kbd>D</kbd> infos techniques · <kbd>M</kbd> radar · <kbd>G</kbd> prochain geste · <kbd>F</kbd> prochain face-à-face</p>
      <p>Dans l’adresse : <code>?seed=7</code> un autre match · <code>?stade=bol|arche|nervures|1-5</code> · <code>?heure=jour|soir|nuit</code> · <code>?cam=auto|tele|rapprochee|tactique|joueur|but|portrait</code> · <code>?vitesse=2</code> · <code>?technicien=0:9</code> un technicien (Olmo) au poste 9 de l’équipe de gauche · <code>?artiste=1:7</code> une anomalie (Taarabt) · <code>?gestes=0</code> · <code>?face=0</code> · <code>?ia</code> leur IA des deux côtés · <code>?contre=ia</code> · <code>?public=0</code> · <code>?ralentis=0</code> · <code>?tenue0=rouge-blanc-raye</code> <code>?tenue1=bleu-ciel</code> les maillots (les identifiants : ${Object.keys(TENUES).join(', ')}) · <code>?manches=longues|courtes|sous-maillot</code> <code>?chaussettes=hautes|moyennes|basses</code> <code>?maillot=rentre|dehors</code> pour les 22 · <code>?portrait=5&amp;angle=180</code> le joueur 5 de près, de dos · <code>?maillots=0</code> les tenues d’origine</p>
    </div>`;
    corps.scrollTop = defile;
  }

  /** LES MAILLOTS (EX-27) : pour chaque équipe, une tenue toute faite, ou ses motifs (maillot, short, chaussettes) et ses couleurs ; l'alerte
   *  quand les deux se confondent. Un changement repeint la tenue en direct (les numéros et les noms suivent). */
  _reglagesMaillots() {
    const m = this.m; if (!m.maillots) return '';
    const hex = (c) => css(c), choix = (o, v) => Object.entries(o).map(([k, x]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${esc(x)}</option>`).join('');
    const bloc = (t) => {
      const T = m.tenues[t];
      const options = `<option value="">— sur mesure —</option>` + Object.entries(TENUES).map(([id, X]) => `<option value="${id}" ${T.id === id ? 'selected' : ''}>${esc(X.nom)}</option>`).join('');
      return `<div class="gh-sous"><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${hex(this.E[t].primary)};margin-right:6px"></i>${esc(this.E[t].nom)}</div>
        <label>Tenue<select data-t="${t}" data-c="id">${options}</select></label>
        <label>Motif du maillot<select data-t="${t}" data-c="motif">${choix(MOTIFS, T.motif)}</select></label>
        <label>Motif du short<select data-t="${t}" data-c="motifShort">${choix(MOTIFS_SHORT, T.motifShort ?? 'uni')}</select></label>
        <label>Motif des chaussettes<select data-t="${t}" data-c="motifChaussettes">${choix(MOTIFS_CHAUSSETTES, T.motifChaussettes ?? 'bande')}</select></label>
        <label>Couleurs (maillot, second, short, chaussettes)<span style="display:flex;gap:6px"><input type="color" data-t="${t}" data-c="c1" value="${hex(T.c1)}"><input type="color" data-t="${t}" data-c="c2" value="${hex(T.c2)}"><input type="color" data-t="${t}" data-c="short" value="${hex(T.short)}"><input type="color" data-t="${t}" data-c="chaussettes" value="${hex(T.chaussettes)}"></span></label>`;
    };
    const alerte = conflit(m.tenues[0], m.tenues[1]) ? '<p style="color:#ff8a80">⚠ Les deux maillots se confondent : changez l’un des deux.</p>'
      : m.exterieur ? '<p>Les maillots se confondaient : l’équipe de droite joue avec son maillot extérieur.</p>' : '';
    return `<div class="gh-sous">Les maillots</div>${bloc(0)}${bloc(1)}${alerte}<p>Les gardiens prennent la couleur la plus éloignée des deux équipes. Les numéros et les noms sont floqués au dos, sur la poitrine et le short, à leur taille réelle.</p>${this._reglagesEquipement()}`;
  }

  /** L'ÉQUIPEMENT DES JOUEURS : chacun le sien (tiré au sort par la graine) ; une règle d'équipe s'impose à ses onze (manches, chaussettes,
   *  maillot), un choix de joueur à lui seul — le joueur choisi se regarde de près (le plan « portrait »). */
  _reglagesEquipement() {
    const m = this.m; if (!m.equipementJoueur) return '';
    const choix = (o, v, vide) => (vide ? `<option value="">${vide}</option>` : '') + Object.entries(o).map(([k, x]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${esc(x.nom ?? x)}</option>`).join('');
    const regles = (t) => `<div class="gh-sous" style="font-size:12px;opacity:.85">${esc(this.E[t].nom)} — pour les onze</div>
      ${['manches', 'chaussettes', 'maillot'].map((c) => `<label>${{ manches: 'Manches', chaussettes: 'Chaussettes', maillot: 'Maillot' }[c]}<select data-q="${t}" data-c="${c}">${choix(EQUIPEMENT[c], m.reglesEquipe[t][c] ?? m.reglesAdresse?.[c] ?? '', 'au choix de chacun')}</select></label>`).join('')}
      <label>L’équipement tiré au sort<button data-a="tirer" data-e="${t}" style="width:auto">Retirer au sort</button></label>`;
    const k = this.joueur ?? m.portrait ?? m.capitaines?.[0] ?? 1, Q = m.equipementJoueur(k), pl = m.players[k];
    const joueurs = m.players.map((p, i) => `<option value="${i}" ${i === k ? 'selected' : ''}>${esc(this.E[p.team].court)} · ${p.numero ?? i + 1} ${esc(m.nomFloque(i) || '?')}${p.gk ? ' (gardien)' : ''}</option>`).join('');
    const sel = (c, lib, o) => `<label>${lib}<select data-j="${c}">${choix(o, Q[c])}</select></label>`;
    const coche = (c, lib) => `<label>${lib}<input type="checkbox" data-j="${c}" ${Q[c] ? 'checked' : ''}></label>`;
    return `<div class="gh-sous">L’équipement des joueurs</div>${regles(0)}${regles(1)}
      <div class="gh-sous" style="font-size:12px;opacity:.85">Un joueur</div>
      <label>Joueur<select data-joueur>${joueurs}</select></label>
      <label>Le regarder de près<button data-a="portrait" style="width:auto">Portrait 🎥</button></label>
      ${(() => { const M = m.morphologieJoueur?.(k); if (!M) return ''; const num = (c, v, a, b) => `<input type="number" data-morpho="${c}" value="${v}" min="${a}" max="${b}" step="1" style="width:72px;background:#141b2c;color:var(--texte);border:1px solid var(--trait);border-radius:6px;padding:4px 6px;font:inherit">`;
        return `<label>Taille (cm)${num('taille', M.taille, 150, 210)}</label><label>Poids (kg)${num('poids', M.poids, 45, 130)}</label>
        <label>Carrure<select data-morpho="carrure">${Object.entries(CARRURES).map(([c, x]) => `<option value="${c}" ${carrureDe(M.taille, M.poids) === c ? 'selected' : ''}>${x.nom}</option>`).join('')}</select></label>
        <p style="margin:2px 0 6px">${esc(m.morphologieTexte(k))}. La taille compte aussi pour le corps (la hauteur de ses touches de balle).</p>`; })()}
      ${(() => { const A = m.tetes && m.apparenceJoueur?.(k); if (!A) return ''; const V = A.visage;
        const opt = (o, v) => Object.entries(o).map(([c, x]) => `<option value="${c}" ${String(v) === c ? 'selected' : ''}>${esc(x)}</option>`).join('');
        const teintes = Object.fromEntries(TEINTS.map((t, i) => [t, `Teinte ${i + 1}${i === 0 ? ' (la plus claire)' : i === 9 ? ' (la plus foncée)' : ''}`]));
        const pastille = (h) => `<i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${h};vertical-align:middle;margin-right:6px;border:1px solid rgba(255,255,255,.25)"></i>`;
        return `<div class="gh-sous" style="font-size:12px;opacity:.85">Son apparence (le visage de la carrière)</div>
        <label>Origine<select data-app="origine">${opt(NOMS_ORIGINES, A.origine)}</select></label>
        <label>Âge<input type="number" data-app="age" value="${A.age}" min="16" max="42" step="1" style="width:64px;background:#141b2c;color:var(--texte);border:1px solid var(--trait);border-radius:6px;padding:4px 6px;font:inherit"></label>
        <label><span>${pastille(V.peau)}Peau</span><select data-app="peau">${opt(teintes, V.peau)}</select></label>
        <label><span>${pastille(V.cheveux)}Cheveux</span><select data-app="cheveux">${opt(COULEURS_CHEVEUX, V.cheveux)}</select></label>
        <label>Coupe<select data-app="coupe">${opt(NOMS_COUPES, V.coupe)}</select></label>
        <label>Barbe<select data-app="pilosite">${opt(NOMS_PILOSITES, V.pilosite)}</select></label>
        <label>Calvitie (%)<input type="number" data-app="calvitie" value="${Math.round(V.calvitie * 100)}" min="0" max="100" step="5" style="width:64px;background:#141b2c;color:var(--texte);border:1px solid var(--trait);border-radius:6px;padding:4px 6px;font:inherit"></label>
        ${[['largeur', 'Largeur du visage (%)', 90, 110], ['machoire', 'Mâchoire (%)', 90, 110], ['ecartYeux', 'Écart des yeux (%)', 92, 108]].map(([c, nom, lo, hi]) => `<label>${nom}<input type="number" data-app="${c}" value="${Math.round((V[c] ?? 1) * 100)}" min="${lo}" max="${hi}" step="1" style="width:64px;background:#141b2c;color:var(--texte);border:1px solid var(--trait);border-radius:6px;padding:4px 6px;font:inherit"></label>`).join('')}
        <label>Le visage de la carrière<button data-a="tirage" style="width:auto">Le reprendre</button></label>
        <p style="margin:2px 0 6px">Le visage suit la loi de la carrière (foot, visage.ts : l’origine de son nom, son âge). Tête ${A.tete === 'B' ? 'B (le volume de cheveux)' : `A (cheveux peints${A.volume ? ', la coupe en volume par-dessus' : ''})`} ; les traits (largeur, mâchoire, yeux) déforment la tête et sa coiffure.</p>`; })()}
      ${sel('manches', 'Manches', EQUIPEMENT.manches)}${Q.manches === 'sous-maillot' ? sel('couleurSous', 'Couleur du sous-maillot', TEINTES) : ''}
      ${sel('maillot', 'Maillot', EQUIPEMENT.maillot)}
      ${sel('chaussettes', 'Chaussettes', EQUIPEMENT.chaussettes)}
      ${coche('antiderapantes', 'Antidérapantes visibles (chaussette coupée)')}${Q.antiderapantes ? sel('couleurAntider', 'Couleur des antidérapantes', TEINTES) : ''}
      ${coche('strapChaussettes', 'Strap sur les chaussettes')}
      ${coche('cuissard', 'Cuissard visible')}${Q.cuissard ? sel('couleurCuissard', 'Couleur du cuissard', TEINTES) : ''}
      ${sel('chaussures', 'Chaussures', CHAUSSURES)}
      ${sel('bandage', 'Bandage de la main', EQUIPEMENT.bandage)}
      ${sel('poignets', 'Strap des poignets', EQUIPEMENT.poignets)}
      ${pl?.gk ? sel('gantsGardien', 'Gants du gardien', { auto: 'Au choix (ils tranchent sur le maillot)', ...GANTS_GARDIEN })
    : `${coche('gants', 'Gants')}${Q.gants ? sel('couleurGants', 'Couleur des gants', TEINTES) : ''}`}
      ${coche('brassard', 'Capitaine (le brassard)')}
      <p>${esc(m.nomFloque(k) || 'Ce joueur')} porte le n° ${pl?.numero ?? k + 1}. Les règles d’équipe passent avant le tirage au sort, les choix d’un joueur avant les règles.</p>`;
  }

  // ———————————————————————————— les commandes ————————————————————————————
  _clic(e) {
    const t = e.target.closest('button'); if (!t) return;
    const m = this.m;
    if (t.dataset.v) return m.regleVitesse(Number(t.dataset.v));
    if (t.dataset.o) { this.onglet = t.dataset.o; return this._rendreStats(true); }
    if (t.dataset.revoir != null) { m.revoirBut(Number(t.dataset.revoir)); if (innerWidth < 640) this.fermer(); return; }
    switch (t.dataset.a) {
      case 'pause': return m.basculerPause();
      case 'recul': return m.reculer(10);
      case 'tempsFort': return m.prochainTempsFort();
      case 'geste': return m.sauterGeste();
      case 'passer': return m.passerLecture();
      case 'stats': return this.ouvrir('stats');
      case 'reglages': return this.ouvrir('reglages');
      case 'portrait': m.portrait = this.joueur ?? m.portrait ?? m.capitaines?.[0] ?? 1; m.reglePlan('portrait'); if (innerWidth < 640) this.fermer(); return;
      case 'tirer': m.tirerEquipement(Number(t.dataset.e)); return this._rendreReglages();
      case 'tirage': m.regleApparence(this.joueur ?? m.portrait ?? m.capitaines?.[0] ?? 1, 'tirage'); return this._rendreReglages();
      case 'fermer': return this.fermer();
    }
  }
  _change(e) {
    const t = e.target, m = this.m;
    if (t.dataset.a === 'plan') { m.reglePlan(t.value); t.blur(); return; }
    // l'équipement : une règle d'équipe, un joueur choisi, un détail de son équipement
    if (t.dataset.q != null) { m.regleEquipe(Number(t.dataset.q), t.dataset.c, t.value || null); return this._rendreReglages(); }
    if (t.dataset.joueur != null) { this.joueur = Number(t.value); if (m.plan === 'portrait') m.portrait = this.joueur; return this._rendreReglages(); }
    if (t.dataset.app != null) { m.regleApparence(this.joueur ?? m.portrait ?? m.capitaines?.[0] ?? 1, t.dataset.app, t.value); return this._rendreReglages(); }
    if (t.dataset.morpho != null) { m.regleMorphologie(this.joueur ?? m.portrait ?? m.capitaines?.[0] ?? 1, t.dataset.morpho, t.value); return this._rendreReglages(); }
    if (t.dataset.j != null) {
      const k = this.joueur ?? m.portrait ?? m.capitaines?.[0] ?? 1;
      m.regleJoueur(k, t.dataset.j, t.type === 'checkbox' ? t.checked : t.value);
      return this._rendreReglages();
    }
    if (t.dataset.t != null) {
      const e = Number(t.dataset.t), c = t.dataset.c, T = { ...m.tenues[e] };
      if (c === 'id') { if (!TENUES[t.value]) return; Object.assign(T, TENUES[t.value], { id: t.value }); }
      else if (c === 'motif' || c === 'motifShort' || c === 'motifChaussettes') { T[c] = t.value; T.id = null; }
      else {
        T[c] = parseInt(t.value.slice(1), 16); T.id = null;
        // le liseré, les chaussettes, le numéro suivent les deux couleurs choisies (la règle des tenues toutes faites)
        if (c === 'c1') { T.chaussettes = T.c1; T.shortB = T.c1; }
        if (c === 'c2') { T.lisere = T.c2; T.bande = T.c2; }
        const clair = (x) => ((x >> 16) & 255) * 0.299 + ((x >> 8) & 255) * 0.587 + (x & 255) * 0.114 > 150;
        T.num = clair(T.c1) ? 0x141414 : 0xf6f6f6; T.numBord = T.c1;
      }
      m.regleTenue(e, T);
      this._rendreReglages();
      return;
    }
    const r = t.dataset.r; if (!r) return;
    m.regle(r, t.type === 'checkbox' ? t.checked : t.value);
  }
  _touche(e) {
    if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'SELECT' || e.ctrlKey || e.metaKey || e.altKey) return;   // (les champs de couleur aussi)
    const m = this.m, k = e.key;
    if (k === ' ') { e.preventDefault(); m.basculerPause(); }
    else if (k >= '1' && k <= '5') m.regleVitesse(VITESSES[Number(k) - 1]);
    else if (k === 'n' || k === 'N') m.prochainTempsFort();
    else if (k === 'b' || k === 'B') m.reculer(10);
    else if (k === 'r' || k === 'R') m.revoirBut(-1);
    else if (k === 'Escape') { if (this.panneau) this.fermer(); else m.passerLecture(); }
    else if (k === 'c' || k === 'C') { const p = Object.keys(PLANS); m.reglePlan(p[(p.indexOf(m.plan) + 1) % p.length]); }
    else if (k === 's' || k === 'S') this.ouvrir('stats');
    else if (k === 'h' || k === 'H') this.racine.classList.toggle('gh-masque');
    else if (k === 'd' || k === 'D') m.regle('technique', !m.reglages.technique);
    else if (k === 'm' || k === 'M') m.regle('radar', !m.reglages.radar);
  }
}
