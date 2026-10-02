// intents.hpp — LES INTENTIONS D'UN CERVEAU EXTERNE, lues par le contrôleur des joueurs (lot L2 du cadrage du moteur de match).
//
// Le moteur garde ses corps : animations, ballon, touches planifiées, réactions physiques (contrôle, amorti, interception,
// tacle), gardiens, arbitre, coups de pied arrêtés. Un cerveau externe (JavaScript, par l'API WebAssembly) pose, joueur par
// joueur, une INTENTION TENUE ; le contrôleur du moteur (`ElizaController`) la lit à trois endroits seulement :
//
//   A. le PLACEMENT sans ballon — à la place des stratégies de rôle (défense, milieu, attaque) ;
//   B. la DÉCISION DU PORTEUR — passer à tel joueur, tirer vers tel point, conduire vers tel point — à la place de la sienne ;
//   C. le PRESSING — `PRESS` force la chasse du porteur adverse, `MOVE` l'interdit (le cerveau a élu ses presseurs).
//
// Un joueur sans intention (ou `GF_AI`) joue exactement comme avant, au bit près : c'est la garde de non-régression.
// Les coordonnées sont celles du MONDE (`gf_frame` : x le long du terrain, y en travers, en mètres) ; l'équipe 2, que le
// moteur traite en miroir, est remise dans son repère au moment de la lecture.
#pragma once

class Player;
class Team;

enum GfIntentKind {
  GF_AI = 0,       // le contrôleur du moteur décide (Eliza)
  GF_MOVE = 1,     // aller en (x, y) à `speed` m/s — placement, appel, repli ; pas de chasse du porteur
  GF_PRESS = 2,    // presser le porteur adverse (sa chasse forcée), en partant vers (x, y)
  GF_PASS = 3,     // porteur : passer à `target` (id stable) — flags 0 courte, 1 longue, 2 haute
  GF_SHOOT = 4,    // porteur : tirer vers (x, y) (un point de la ligne de but), `power` 0..1
  GF_DRIBBLE = 5,  // porteur : conduire vers (x, y) à `speed` m/s
};

struct GfIntent {
  int kind = GF_AI;
  float x = 0.0f, y = 0.0f;
  float speed = 0.0f;
  int target = -1;
  float power = 0.0f;
  int flags = 0;
};

/** Active le mode intentions (les tables sont vidées à chaque changement). */
void gf_intents_enable(bool on);
/** Pose l'intention d'un joueur (id stable). */
void gf_intent_set(int stableId, const GfIntent &intent);
/** L'intention TENUE d'un joueur, ou nullptr (mode coupé, aucune intention, ou `GF_AI`). */
const GfIntent *gf_intent(Player *player);
/** Un joueur actif de `team` par son id stable, ou nullptr. */
Player *gf_player_by_stable(Team *team, int stableId);

// ── LE JOURNAL ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// Le moteur n'a pas de flux d'événements (Google Research Football compare des observations) : on note aux points d'accroche
// — chaque touche, chaque but, chaque faute sifflée, chaque hors-jeu, chaque coup de pied arrêté. Huit nombres par
// événement : [type, temps ms, équipe, joueur (id stable), a, b, c, d].
enum GfEventType {
  GF_EV_TOUCH = 1,     // a = type de touche (e_TouchType), b = fonction en cours (e_FunctionType)
  GF_EV_GOAL = 2,      // équipe créditée ; joueur = buteur ou -1 ; a = 1 si contre son camp
  GF_EV_FOUL = 3,      // équipe du fautif ; a = gravité (1 faute, 2 jaune, 3 rouge) ; b = victime ; c = 1 si penalty
  GF_EV_OFFSIDE = 4,   // équipe et joueur hors-jeu
  GF_EV_SETPIECE = 5,  // équipe qui reprend ; a = e_GameMode
};
static const int GF_EV_SIZE = 8;
void gf_event(int type, int team, int player, float a = 0, float b = 0, float c = 0, float d = 0);
/** Le journal accumulé depuis la dernière lecture : pointeur et nombre d'événements ; la lecture le vide. */
const float *gf_events_take(int *count);
