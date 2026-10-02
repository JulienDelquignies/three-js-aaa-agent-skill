// gf_api.cpp — L'API WebAssembly du moteur de match de Google Research Football (Gameplay Football, licence Unlicense) :
// un match 11 contre 11, l'IA du jeu des deux côtés, sans rendu ; l'état et les POSES (les 13 articulations de chaque joueur)
// lus par JavaScript sur la mémoire du module (vues Float32). La même séquence que l'environnement Python
// (football_env_core.py) : start_game → reset(ScenarioConfig) → step × n → get_info, plus l'export des poses que Python n'a pas.
//
// Repère : les MÈTRES du moteur (x le long du terrain, ±55 ; y en travers, ±36 ; z en haut). L'équipe 2 est traitée par le
// moteur EN MIROIR (Match::GetTeamState la rétablit en niant x et y) : on fait de même pour sa racine, et son corps tourne de
// 180° autour de z. Les rotations des nœuds sont LOCALES (relatives au parent), comme dans les fichiers .anim.
#include <cstdlib>
#include <string>
#include <vector>
#include <emscripten/emscripten.h>

#include "game_env.hpp"
#include "main.hpp"
#include "gametask.hpp"
#include "onthepitch/match.hpp"
#include "onthepitch/team.hpp"
#include "onthepitch/ball.hpp"
#include "onthepitch/referee.hpp"
#include "onthepitch/player/player.hpp"
#include "intents.hpp"

static GameEnv *g_env = nullptr;
static std::vector<float> g_frame, g_pose;
// l'ordre des fichiers .anim (celui de gpf-anim.js), traduit en indices de l'énumération BodyPart du moteur (utils/animation.hpp)
static const BodyPart NODES[13] = {body, middle, neck, left_shoulder, left_elbow, right_shoulder, right_elbow,
                                   left_thigh, left_knee, left_ankle, right_thigh, right_knee, right_ankle};
static const int MAXP = 22, FRAME_HEAD = 16, FRAME_PER = 19, POSE_PER = 3 + 13 * 4;

static void add(SHARED_PTR<ScenarioConfig> &sc, bool left, float x, float y, e_PlayerRole role) {
  FormationEntry p(x, y, role, false, true);
  (left ? sc->left_team : sc->right_team).push_back(p);
}
// le 11 contre 11 de 11_vs_11_stochastic.py (les deux équipes décrites du côté gauche : le moteur retourne la seconde)
static void team11(SHARED_PTR<ScenarioConfig> &sc, bool left, bool kickoff) {
  add(sc, left, -1.000000, 0.000000, e_PlayerRole_GK);
  if (kickoff) { add(sc, left, 0.000000, 0.020000, e_PlayerRole_RM); add(sc, left, 0.000000, -0.020000, e_PlayerRole_CF); }
  else { add(sc, left, -0.050000, 0.000000, e_PlayerRole_RM); add(sc, left, -0.010000, 0.216102, e_PlayerRole_CF); }
  add(sc, left, -0.422000, -0.19576, e_PlayerRole_LB);
  add(sc, left, -0.500000, -0.06356, e_PlayerRole_CB);
  add(sc, left, -0.500000, 0.063559, e_PlayerRole_CB);
  add(sc, left, -0.422000, 0.195760, e_PlayerRole_RB);
  add(sc, left, -0.184212, -0.10568, e_PlayerRole_CM);
  add(sc, left, -0.267574, 0.000000, e_PlayerRole_CM);
  add(sc, left, -0.184212, 0.105680, e_PlayerRole_CM);
  add(sc, left, -0.010000, -0.21610, e_PlayerRole_LM);
}

extern "C" {

/** Démarrer le moteur. physicsStepsPerFrame : pas physiques de 10 ms par appel à gf_step (1 = 10 ms) ;
 *  matchDuration : la vitesse du chrono (0,027 = ×18 de Google Research Football ; 4,75 = 90 vraies minutes). */
EMSCRIPTEN_KEEPALIVE int gf_init(int physicsStepsPerFrame, float matchDuration) {
  if (g_env) return 0;
  setenv("GFOOTBALL_DATA_DIR", "/data", 1);
  setenv("GFOOTBALL_FONT", "/data/media/fonts/dejavu/DejaVuSansMono.ttf", 1);   // comme la version Python : la police n'est pas cherchée sous data_dir
  setenv("GFOOTBALL_MATCH_DURATION", std::to_string(matchDuration).c_str(), 1);
  g_env = new GameEnv();
  g_env->game_config.render = false;
  g_env->game_config.physics_steps_per_frame = physicsStepsPerFrame;
  g_env->start_game();
  g_frame.assign(FRAME_HEAD + MAXP * FRAME_PER, 0.f);
  g_pose.assign(MAXP * POSE_PER, 0.f);
  return 1;
}

/** Un nouveau match : graine, difficultés de l'IA (1,0 = la meilleure), durée en appels à gf_step. */
EMSCRIPTEN_KEEPALIVE int gf_reset(int seed, float leftDifficulty, float rightDifficulty, int gameDuration) {
  if (!g_env) return 0;
  auto sc = ScenarioConfig::make();
  team11(sc, true, true);
  team11(sc, false, false);
  sc->left_agents = 0; sc->right_agents = 0;          // personne ne pilote : l'IA du jeu joue les 22
  sc->left_team_difficulty = leftDifficulty; sc->right_team_difficulty = rightDifficulty;
  sc->deterministic = false;
  sc->game_engine_random_seed = seed;
  sc->reverse_team_processing = (seed % 2) != 0;      // comme scenario_builder.py
  sc->game_duration = gameDuration;
  sc->offsides = true;
  gf_arrets_set(nullptr, 0);                          // l'horloge du match : aucun supplément tant qu'on n'en pose pas
  g_env->reset(*sc, true);
  return 1;
}

/** Avancer de n appels (chacun = physicsStepsPerFrame pas de 10 ms). */
EMSCRIPTEN_KEEPALIVE void gf_step(int n) { while (n-- > 0) g_env->step(); }

/** L'état : en-tête [temps ms, en jeu, coup de pied arrêté, mode, score G, score D, ballon x y z, possession équipe, joueur,
 *  pas, nombre de joueurs, vitesse du ballon x y z (m/s)] puis par joueur [équipe, rôle, x, y, z, dir x, dir y, corps x, corps y,
 *  vitesse, id stable, actif, vitesse x, vitesse y (m/s), geste en cours (e_FunctionType), possède le ballon, désigné pour le
 *  ballon (match), désigné dans son équipe, tient le ballon en main]. Lecture seule : ces accesseurs ne calculent rien. */
EMSCRIPTEN_KEEPALIVE float *gf_frame() {
  Match *m = GetGameTask()->GetMatch();
  SharedInfo info = g_env->get_info();
  float *f = g_frame.data();
  f[0] = (float)m->GetActualTime_ms(); f[1] = m->IsInPlay(); f[2] = m->IsInSetPiece(); f[3] = (float)info.game_mode;
  f[4] = (float)m->GetScore(0); f[5] = (float)m->GetScore(1);
  Vector3 b = m->GetBall()->Predict(0);
  f[6] = b.coords[0]; f[7] = b.coords[1]; f[8] = b.coords[2];
  f[9] = (float)info.ball_owned_team; f[10] = (float)info.ball_owned_player; f[11] = (float)info.step;
  Vector3 bv = m->GetBall()->GetMovement();
  f[13] = bv.coords[0]; f[14] = bv.coords[1]; f[15] = bv.coords[2];
  int k = 0;
  for (int t = 0; t < 2; t++) {
    std::vector<Player *> players;
    m->GetTeam(t)->GetAllPlayers(players);
    for (auto p : players) {
      if (k >= MAXP) break;
      float *q = f + FRAME_HEAD + k * FRAME_PER;
      Vector3 pos = p->GetPosition(), dir = p->GetDirectionVec(), body = p->GetBodyDirectionVec(), mv = p->GetMovement();
      if (t == 1) { pos.Mirror(); dir.Mirror(); body.Mirror(); mv.Mirror(); }
      q[0] = t; q[1] = (float)p->GetFormationEntry().role; q[2] = pos.coords[0]; q[3] = pos.coords[1]; q[4] = pos.coords[2];
      q[5] = dir.coords[0]; q[6] = dir.coords[1]; q[7] = body.coords[0]; q[8] = body.coords[1];
      q[9] = mv.GetLength(); q[10] = (float)p->GetStableID(); q[11] = p->IsActive() ? 1.f : 0.f;
      q[12] = mv.coords[0]; q[13] = mv.coords[1];
      q[14] = (float)p->GetCurrentFunctionType(); q[15] = p->HasPossession() ? 1.f : 0.f;
      q[16] = m->GetDesignatedPossessionPlayer() == p ? 1.f : 0.f;
      q[17] = m->GetTeam(t)->GetDesignatedTeamPossessionPlayer() == p ? 1.f : 0.f;
      q[18] = m->GetBallRetainer() == p ? 1.f : 0.f;
      k++;
    }
  }
  f[12] = (float)k;
  return f;
}

/** Les poses : par joueur [racine x y z (le nœud « player » : mètres, z = hauteur portée par l'animation),
 *  puis 13 quaternions LOCAUX (x, y, z, w) dans l'ordre de NODES]. Équipe 2 : racine niée en x, y ; corps tourné de 180°. */
EMSCRIPTEN_KEEPALIVE float *gf_pose() {
  Match *m = GetGameTask()->GetMatch();
  float *f = g_pose.data();
  int k = 0;
  for (int t = 0; t < 2; t++) {
    std::vector<Player *> players;
    m->GetTeam(t)->GetAllPlayers(players);
    for (auto p : players) {
      if (k >= MAXP) break;
      float *q = f + k * POSE_PER;
      const NodeMap &nm = p->GetNodeMap();
      Vector3 root = nm[player] ? nm[player]->GetPosition() : p->GetPosition();
      if (t == 1) root.Mirror();
      q[0] = root.coords[0]; q[1] = root.coords[1]; q[2] = root.coords[2];
      for (int n = 0; n < 13; n++) {
        Quaternion r = nm[NODES[n]] ? nm[NODES[n]]->GetRotation() : Quaternion(QUATERNION_IDENTITY);
        if (t == 1 && n == 0) { Quaternion z180; z180.SetAngleAxis(pi, Vector3(0, 0, 1)); r = z180 * r; }
        q[3 + n * 4 + 0] = r.elements[0]; q[3 + n * 4 + 1] = r.elements[1]; q[3 + n * 4 + 2] = r.elements[2]; q[3 + n * 4 + 3] = r.elements[3];
      }
      k++;
    }
  }
  return f;
}

// ── LE CERVEAU EXTERNE (lot L2) ──────────────────────────────────────────────────────────────────────────────────────

/** Active (1) ou coupe (0) le mode intentions — à appeler APRÈS gf_reset (les ids stables des joueurs y naissent). */
EMSCRIPTEN_KEEPALIVE void gf_intents(int on) { gf_intents_enable(on != 0); }

/** L'intention TENUE d'un joueur (id stable, colonne 10 de gf_frame). Voir intents.hpp : kind 0 IA, 1 aller, 2 presser,
 *  3 passer à `target` (flags 0 courte, 1 longue, 2 haute), 4 tirer vers (x, y), 5 conduire vers (x, y). Coordonnées du
 *  monde, en mètres ; vitesses en m/s (0 à 8). */
EMSCRIPTEN_KEEPALIVE void gf_set_intent(int stableId, int kind, float x, float y, float speed, int target, float power, int flags) {
  GfIntent i;
  i.kind = kind; i.x = x; i.y = y; i.speed = speed; i.target = target; i.power = power; i.flags = flags;
  gf_intent_set(stableId, i);
}

static int g_nEvents = 0;
/** Le journal depuis la dernière lecture (GF_EV_SIZE nombres par événement), et le vide ; `gf_events_n` dit combien. */
EMSCRIPTEN_KEEPALIVE const float *gf_events() { return gf_events_take(&g_nEvents); }
EMSCRIPTEN_KEEPALIVE int gf_events_n() { return g_nEvents; }

/** LES ATTRIBUTS D'UN JOUEUR (id stable, PlayerStat dans l'ordre de utils.hpp : 0 équilibre, 1 réaction, 2 accélération,
 *  3 vitesse, 4 endurance, 5 agilité, 6 puissance de frappe, 7 tacle debout, 8 tacle glissé, 9 contrôle, 10 dribble,
 *  11 passe courte, 12 passe haute, 13 tête, 14 frappe, 15 volée, 16 calme, 17 activité, 18 résilience, 19 placement
 *  défensif, 20 placement offensif, 21 vision). La valeur de base (0..1) : le moteur la multiplie ensuite par la difficulté
 *  et la fatigue (Player::GetStat). */
static Player *joueurParId(int stableId) {
  Match *m = GetGameTask()->GetMatch();
  for (int t = 0; t < 2; t++) {
    std::vector<Player *> players;
    m->GetTeam(t)->GetAllPlayers(players);
    for (auto p : players) if (p->GetStableID() == stableId) return p;
  }
  return nullptr;
}
EMSCRIPTEN_KEEPALIVE int gf_set_stat(int stableId, int stat, float value) {
  Player *p = joueurParId(stableId);
  if (!p || stat < 0 || stat >= player_stat_max) return 0;
  const_cast<PlayerData *>(p->GetPlayerData())->SetStat((PlayerStat)stat, value);
  return 1;
}
EMSCRIPTEN_KEEPALIVE float gf_get_stat(int stableId, int stat) {
  Player *p = joueurParId(stableId);
  if (!p || stat < 0 || stat >= player_stat_max) return -1.0f;
  return p->GetPlayerData()->GetStat((PlayerStat)stat);
}

/** L'HORLOGE DU MATCH : les suppléments (ms) de chaque remise en jeu, au-delà des ≈ 4 s que le corps simule — engagement
 *  après un but, six-mètres, coup franc (faute ou hors-jeu), corner, touche, penalty (voir intents.hpp). */
EMSCRIPTEN_KEEPALIVE void gf_set_arrets(float engagement, float sixMetres, float coupFranc, float corner, float touche, float penalty) {
  const float ms[8] = {0, engagement, sixMetres, coupFranc, corner, touche, penalty, 0};
  gf_arrets_set(ms, 8);
}
/** LA MI-TEMPS, sifflée maintenant (à la première action en jeu) : l'arbitre du corps arrête le jeu et donne l'engagement
 *  de la seconde période à l'autre équipe (sa logique de seconde période, déclenchée par l'horloge continue du match
 *  plutôt que par la sienne, qui s'arrête quand le ballon est mort). Les équipes ne changent pas de côté. */
EMSCRIPTEN_KEEPALIVE int gf_mi_temps() { GetScenarioConfig().second_half = 0; return 1; }

/** LA FAUTE DÉCIDÉE PAR LE CERVEAU (ids stables ; gravité 1 faute, 2 jaune, 3 rouge ; le lieu de la faute, monde) : l'arbitre
 *  du corps la siffle au pas suivant — arrêt, coup franc au lieu de la faute ou penalty s'il est dans la surface, carton.
 *  0 si refusée (jeu déjà arrêté…). */
EMSCRIPTEN_KEEPALIVE int gf_faute(int fautifId, int victimeId, int gravite, float x, float y) {
  Match *m = GetGameTask()->GetMatch();
  Player *f = joueurParId(fautifId), *v = joueurParId(victimeId);
  if (!f || !v || f->GetTeam() == v->GetTeam() || !m->IsInPlay() || m->IsInSetPiece()) return 0;
  m->GetReferee()->GfFaute(f, v, gravite < 1 ? 1 : gravite > 3 ? 3 : gravite, Vector3(x, y, 0));
  return 1;
}
/** LE CARTON SANS ARRÊT (l'avantage joué : la Loi 12 le montre au prochain arrêt — ici, tout de suite) : 2 jaune, 3 rouge.
 *  Le journal le note comme une faute non sifflée (c = −1). */
EMSCRIPTEN_KEEPALIVE int gf_carton(int joueurId, int couleur) {
  Match *m = GetGameTask()->GetMatch();
  Player *p = joueurParId(joueurId);
  if (!p) return 0;
  if (couleur >= 3) p->GiveRedCard(m->GetActualTime_ms() + 6000); else p->GiveYellowCard(m->GetActualTime_ms() + 6000);
  gf_event(GF_EV_FOUL, p->GetTeam()->GetID(), p->GetStableID(), couleur >= 3 ? 3.0f : 2.0f, -1.0f, -1.0f);
  return 1;
}

EMSCRIPTEN_KEEPALIVE int gf_frame_head() { return FRAME_HEAD; }
EMSCRIPTEN_KEEPALIVE int gf_frame_per() { return FRAME_PER; }
EMSCRIPTEN_KEEPALIVE int gf_pose_per() { return POSE_PER; }
}
