// rondo-tactiques.js — LES TACTIQUES DANS LE PRODUIT (26/09, audit : « le spectateur voit toujours équilibre contre équilibre » — le moteur
// a 15 axes tactiques, 7 presets, ~50 rôles, rien n'était exposé). Chaque équipe reçoit un PRESET (tactics.js) et une FORMATION
// (formation.js), et ses RÔLES : ceux de la formation (ROLES_FORMATION : le 9 de surface, les pistons, le meneur…) puis ceux du preset
// quand il parle de la même grille (les presets sont écrits en 4-3-3). ?tacA / ?tacB (preset), ?formA / ?formB (formation). Défaut du
// produit : Possession en 4-3-3 contre Jeu direct en 4-4-2 — deux identités qui se voient. Le panneau « Tactiques » rejoue avec d'autres.
import { TACTIQUES } from '../engine/tactics.js';
import { ROLES_FORMATION, FORMATIONS } from '../engine/formation.js';
import { genererEffectif, familleDe } from '../engine/effectif.js';

export const NOMS_TACTIQUES = { equilibre: 'Équilibre', possession: 'Possession', gegenpressing: 'Gegenpressing', ligneHaute: 'Ligne haute', direct: 'Jeu direct', largeEtCentres: 'Largeur et centres', blocBas: 'Bloc bas' };
export const FORMATIONS_PRODUIT = ['433', '442', '4231', '4141', '4411', '352', '343', '3421', '532', '541'];
const DEFAUT = [{ t: 'possession', f: '433' }, { t: 'direct', f: '442' }];

export const formatDe = (f) => String(f).split('').join('-');

/** Les tactiques et rôles des deux équipes depuis l'URL (défauts du produit). Rend { tactics, roles, choix }. */
export function tactiquesDe(q, noms = null) {
  const choix = [0, 1].map((k) => {
    const A = 'AB'[k], t = q.get(`tac${A}`), f = q.get(`form${A}`);
    return { t: TACTIQUES[t] ? t : DEFAUT[k].t, f: FORMATIONS[f] ? f : DEFAUT[k].f };
  });
  const tactics = choix.map(({ t, f }) => ({ ...TACTIQUES[t], formation: f, nom: t }));
  const roles = choix.map(({ t, f }) => ({ ...(ROLES_FORMATION[f] ?? {}), ...(f === '433' ? TACTIQUES[t].roles ?? {} : {}) }));
  // LES EFFECTIFS NOTÉS (engine/effectif.js) : chaque joueur a ses 40 notes — le profil de son poste, l'accent de son rôle, sa qualité —
  // autour du niveau de l'équipe (?niveauA / ?niveauB, défaut 64 / 62) ; ?effectifs=0 : les 22 joueurs identiques d'hier (notés 50)
  const seed = Number(q.get('seed')) || 7, niv = [Number(q.get('niveauA')) || 64, Number(q.get('niveauB')) || 62];
  const squads = q.get('effectifs') === '0' ? null : choix.map(({ f }, k) => genererEffectif({ formation: f, roles: roles[k], niveau: niv[k], graine: seed * 2 + k + 1, noms: noms ? noms.slice(k * 11, k * 11 + 11) : null }));
  return { tactics, roles, choix, squads };
}

/** Le panneau « Tactiques » (dans la barre du produit) : preset + formation par équipe, « Rejouer » recharge avec ces choix. */
export function panneauTactiques(ctl, teams, choix, squads = null, roles = null) {
  if (typeof document === 'undefined') return null;
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:12px;top:196px;z-index:41;display:none;width:min(340px,calc(100vw - 24px));padding:12px 14px;border-radius:10px;background:rgba(12,14,20,.92);color:#e8ebf2;font:500 13px/1.45 system-ui,sans-serif';
  const sel = (opts, v) => { const s = document.createElement('select'); s.style.cssText = 'width:100%;height:30px;margin:3px 0 8px;border:0;border-radius:6px;background:#2a2f3a;color:#e8ebf2;font:inherit;padding:0 6px'; for (const [k, l] of opts) { const o = document.createElement('option'); o.value = k; o.textContent = l; if (k === v) o.selected = true; s.appendChild(o); } return s; };
  const S = choix.map((c, k) => {
    const h = document.createElement('div'); h.innerHTML = `<b style="color:#d7ff3c">${teams[k].name}</b>`; box.appendChild(h);
    const st = sel(Object.entries(NOMS_TACTIQUES), c.t), sf = sel(FORMATIONS_PRODUIT.map((f) => [f, formatDe(f)]), c.f); box.append(st, sf); return { st, sf };
  });
  const go = document.createElement('button'); go.textContent = 'Rejouer avec ces tactiques';
  go.style.cssText = 'width:100%;height:34px;border:0;border-radius:6px;background:#d7ff3c;color:#07090f;font:700 14px system-ui,sans-serif;cursor:pointer';
  go.addEventListener('click', () => { const u = new URL(location.href); S.forEach((s, k) => { u.searchParams.set(`tac${'AB'[k]}`, s.st.value); u.searchParams.set(`form${'AB'[k]}`, s.sf.value); }); location.href = u.toString(); });
  box.appendChild(go);
  // LES FEUILLES DE MATCH (les attributs, visibles) : poste, nom, rôle, les notes qui font le poste + décisions
  if (squads) for (const [k, E] of squads.entries()) { const f = document.createElement('div'); f.style.cssText = 'margin-top:10px;font:500 12px/1.5 system-ui,sans-serif'; f.innerHTML = feuilleHtml(teams[k], E, roles?.[k]); box.appendChild(f); }
  box.style.maxHeight = 'calc(100vh - 260px)'; box.style.overflow = 'auto';
  document.body.appendChild(box);
  const b = document.createElement('button'); b.textContent = 'Tactiques'; b.title = 'Formations et tactiques (T)';
  b.style.cssText = 'min-width:34px;height:30px;padding:0 10px;border:0;border-radius:6px;background:#2a2f3a;color:#e8ebf2;font:inherit;cursor:pointer';
  const bascule = () => { box.style.display = box.style.display === 'none' ? 'block' : 'none'; };
  b.addEventListener('click', bascule); ctl.insertBefore(b, ctl.querySelector('select'));
  window.addEventListener('keydown', (e) => { if ((e.key === 't' || e.key === 'T') && !/INPUT|SELECT|TEXTAREA/.test(e.target?.tagName ?? '')) bascule(); });
  return box;
}

/** La ligne des compositions (bandeau d'avant-match du tableau) : « 4-3-3 · Possession ». */
export const libelle = (c) => `${formatDe(c.f)} · ${NOMS_TACTIQUES[c.t] ?? c.t}`;

const NOMS_ROLES = { neufDeSurface: 'Neuf de surface', meneur: 'Meneur', recuperateur: 'Récupérateur', piston: 'Piston', ailierDePercussion: 'Ailier de percussion', stopper: 'Stoppeur' };
const CLES = { GK: [['keeping', 'Gar'], ['reactions', 'Réf'], ['handling', 'Pri']], D: [['tackling', 'Tac'], ['marking', 'Mar'], ['heading', 'Tête']], DL: [['pace', 'Vit'], ['crossing', 'Cen'], ['tackling', 'Tac']],
  WB: [['pace', 'Vit'], ['crossing', 'Cen'], ['stamina', 'End']], DM: [['tackling', 'Tac'], ['positioning', 'Pla'], ['passing', 'Pas']], M: [['passing', 'Pas'], ['vision', 'Vis'], ['stamina', 'End']],
  ML: [['pace', 'Vit'], ['crossing', 'Cen'], ['dribbling', 'Dri']], AM: [['vision', 'Vis'], ['technique', 'Tec'], ['dribbling', 'Dri']], AL: [['pace', 'Vit'], ['dribbling', 'Dri'], ['flair', 'Fla']],
  ST: [['finishing', 'Fin'], ['offTheBall', 'Apl'], ['composure', 'SgF']] };
const teinte = (v) => v >= 80 ? '#7ee07e' : v >= 65 ? '#d7ff3c' : v >= 50 ? '#e8ebf2' : '#9aa3b2';
/** La feuille d'une équipe : une ligne par joueur — poste, nom, rôle, trois notes du poste, décisions (couleur par palier, FM). */
function feuilleHtml(team, E, roles) {
  const lignes = E.map((f, k) => { const fam = familleDe(f.postes[0]), C = CLES[fam] ?? CLES.M, r = f.ratings, ro = roles?.[k] ? NOMS_ROLES[roles[k]] ?? roles[k] : '';
    const n = (key, lab) => `<span style="display:inline-block;width:56px"><span style="opacity:.55">${lab}</span> <b style="color:${teinte(r[key])}">${r[key]}</b></span>`;
    return `<div style="border-top:1px solid #2a2f3a;padding:2px 0"><span style="display:inline-block;width:50px;opacity:.7">${f.postes[0]}</span><b>${f.name ?? '—'}</b>${ro ? ` <span style="opacity:.6;font-size:11px">${ro}</span>` : ''}<br>${C.map(([a, b]) => n(a, b)).join('')}${n('decisions', 'Déc')}</div>`; });
  return `<b style="color:#d7ff3c">Effectif — ${team.name}</b>${lignes.join('')}`;
}
