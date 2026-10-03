// intents.cpp — les intentions d'un cerveau externe et le journal des événements (voir intents.hpp).
//
// Les trois lectures (A placement, B décision du porteur, C pressing) sont des MÉTHODES d'ElizaController définies ici :
// elles appellent ses constructeurs de commandes protégés (`_AddPass`…). Les correctifs (`patch.py`) n'ajoutent dans le
// moteur que leurs déclarations et trois appels.
#include <algorithm>
#include <cmath>
#include <unordered_map>
#include <vector>

#include "intents.hpp"
#include "main.hpp"
#include "gametask.hpp"
#include "onthepitch/match.hpp"
#include "onthepitch/team.hpp"
#include "onthepitch/player/player.hpp"
#include "onthepitch/player/controller/elizacontroller.hpp"
#include "onthepitch/player/humanoid/humanoid.hpp"
#include "onthepitch/player/humanoid/humanoid_utils.hpp"
#include "onthepitch/ball.hpp"
#include "utils/animationextensions/footballanimationextension.hpp"

static bool g_actif = false;
static std::unordered_map<int, GfIntent> g_intentions;
static std::vector<float> g_journal, g_lu;
/** La dernière touche notée : un porteur qui garde le ballon le « touche » à chaque pas (team.cpp, la conduite) — on ne
 *  note une touche que si le joueur ou le geste change. */
static int g_dernierToucheur = -1, g_dernierGeste = -1;

void gf_intents_enable(bool on) {
  g_actif = on;
  g_intentions.clear();
  g_journal.clear();
  g_dernierToucheur = g_dernierGeste = -1;
}

void gf_intent_set(int stableId, const GfIntent &intent) { g_intentions[stableId] = intent; }

const GfIntent *gf_intent(Player *player) {
  if (!g_actif || !player) return nullptr;
  auto it = g_intentions.find(player->GetStableID());
  if (it == g_intentions.end() || it->second.kind == GF_AI) return nullptr;
  return &it->second;
}

Player *gf_player_by_stable(Team *team, int stableId) {
  if (!team) return nullptr;
  std::vector<Player *> joueurs;
  team->GetActivePlayers(joueurs);
  for (auto p : joueurs) if (p->GetStableID() == stableId) return p;
  return nullptr;
}

void gf_event(int type, int team, int player, float a, float b, float c, float d) {
  if (!g_actif) return;
  if (type == GF_EV_TOUCH) {
    if (player == g_dernierToucheur && (int)b == g_dernierGeste) return;
    g_dernierToucheur = player; g_dernierGeste = (int)b;
  }
  auto m = GetGameTask()->GetMatch();
  const float ev[GF_EV_SIZE] = {(float)type, m ? (float)m->GetActualTime_ms() : 0.0f, (float)team, (float)player, a, b, c, d};
  g_journal.insert(g_journal.end(), ev, ev + GF_EV_SIZE);
}

static float g_arrets[8] = {0, 0, 0, 0, 0, 0, 0, 0};
unsigned long gf_arret_ms(int mode) { return mode >= 0 && mode < 8 && g_arrets[mode] > 0 ? (unsigned long)g_arrets[mode] : 0; }
void gf_arrets_set(const float *ms, int n) { for (int i = 0; i < 8; i++) g_arrets[i] = i < n ? ms[i] : 0.0f; }

static std::vector<int> g_animComptes[4];
void gf_anim_compte(int etage, int animId) {
  if (etage < 0 || etage > 3 || animId < 0) return;
  auto &v = g_animComptes[etage];
  if ((int)v.size() <= animId) v.resize(animId + 1, 0);
  v[animId]++;
}
const int *gf_anim_comptes(int etage, int n) {
  auto &v = g_animComptes[etage < 0 || etage > 3 ? 0 : etage];
  if ((int)v.size() < n) v.resize(n, 0);
  return v.data();
}
void gf_anim_comptes_raz() { for (auto &v : g_animComptes) std::fill(v.begin(), v.end(), 0); }

const float *gf_events_take(int *count) {
  g_lu.swap(g_journal);
  g_journal.clear();
  *count = (int)(g_lu.size() / GF_EV_SIZE);
  return g_lu.data();
}

// ── LE REPÈRE ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// Pendant le traitement de l'équipe 2, le monde entier est en miroir (Match::Process) : un point du monde (x, y) y vaut
// (-x, -y). L'équipe 1 travaille dans le monde tel quel.
static Vector3 versLeRepereDe(Team *team, float x, float y) {
  return team && team->GetID() == 1 ? Vector3(-x, -y, 0) : Vector3(x, y, 0);
}

// ── A. LE PLACEMENT ───────────────────────────────────────────────────────────────────────────────────────────────────
// Aller en (x, y) à la vitesse demandée ; ralentir à l'approche, s'arrêter dans le demi-mètre (tourné vers le ballon).
void ElizaController::_GfPlacement(Vector3 &rawInputDirection, float &rawInputVelocityFloat) {
  const GfIntent *gi = gf_intent(CastPlayer());
  if (!gi || (gi->kind != GF_MOVE && gi->kind != GF_PRESS)) return;
  Vector3 cible = versLeRepereDe(team, gi->x, gi->y);
  Vector3 vers = cible - player->GetPosition();
  vers.coords[2] = 0.0f;
  float d = vers.GetLength();
  if (d < 0.5f) {
    Vector3 ballon = match->GetBall()->Predict(0).Get2D() - player->GetPosition();
    ballon.coords[2] = 0.0f;
    rawInputDirection = ballon.GetNormalized(player->GetDirectionVec());
    rawInputVelocityFloat = idleVelocity;
    return;
  }
  rawInputDirection = vers.GetNormalized(player->GetDirectionVec());
  // l'arrivée : la vitesse demandée, plafonnée par la distance (le même coefficient que leurs stratégies)
  rawInputVelocityFloat = clamp(std::min(gi->speed, d * distanceToVelocityMultiplier), idleVelocity, sprintVelocity);
}

// ── B. LA DÉCISION DU PORTEUR ─────────────────────────────────────────────────────────────────────────────────────────
// Rend true quand le cerveau a décidé : la commande est posée (passe, tir) ou la conduite orientée (dribble). Sinon le
// contrôleur décide lui-même (`GetOnTheBallCommands`).
bool ElizaController::_GfOnBall(std::vector<PlayerCommand> &commandQueue, Vector3 &rawInputDirection, float &rawInputVelocityFloat) {
  const GfIntent *gi = gf_intent(CastPlayer());
  if (!gi) return false;
  if (gi->kind == GF_PASS) {
    Player *cible = gf_player_by_stable(team, gi->target);
    if (!cible || cible == CastPlayer()) return false;
    e_FunctionType genre = gi->flags == 2 ? e_FunctionType_HighPass : gi->flags == 1 ? e_FunctionType_LongPass : e_FunctionType_ShortPass;
    _AddPass(commandQueue, cible, genre);
    return true;
  }
  if (gi->kind == GF_SHOOT) {
    Vector3 but = versLeRepereDe(team, gi->x, gi->y);
    Vector3 dir = (but - (CastPlayer()->GetPosition() + CastPlayer()->GetMovement() * 0.2f));
    dir.coords[2] = 0.0f;
    dir = dir.GetNormalized(Vector3(-team->GetDynamicSide(), 0, 0));
    PlayerCommand command;
    command.desiredFunctionType = e_FunctionType_Shot;
    command.useDesiredMovement = false;
    command.useDesiredLookAt = false;
    command.desiredVelocityFloat = rawInputVelocityFloat;
    command.touchInfo.desiredDirection = dir;
    // la frappe part selon `desiredDirection` et `desiredPower` (GetShotVector, humanoid_utils.cpp) — la visée automatique
    // recalculée au contact n'est jamais transmise (humanoid.cpp, le tir) ; erreur selon l'angle du corps et la stat de tir
    command.touchInfo.inputDirection = dir;
    command.touchInfo.autoDirectionBias = 1.0f;
    command.touchInfo.desiredPower = clamp(gi->power, 0.3f, 1.0f);
    commandQueue.push_back(command);
    return true;
  }
  if (gi->kind == GF_MOVE || gi->kind == GF_PRESS) {
    // PAS ENCORE D'ORDRE DE PORTEUR : le ballon vient d'arriver, le cerveau tranchera à son prochain tick (≤ 100 ms). Laisser
    // le contrôleur décider ici, c'était lui laisser la passe en une touche — mesuré : 45 % des passes de nos matchs
    // venaient de lui, pas du cerveau. Le joueur garde le ballon et le conduit vers son placement, au pas de conduite.
    Vector3 cible = versLeRepereDe(team, gi->x, gi->y);
    Vector3 vers = cible - player->GetPosition();
    vers.coords[2] = 0.0f;
    rawInputDirection = vers.GetLength() > 1.0f ? vers.GetNormalized(player->GetDirectionVec()) : player->GetDirectionVec();
    rawInputVelocityFloat = std::min(gi->speed, dribbleVelocity);
    return true;
  }
  if (gi->kind == GF_GESTE) {
    // UN GESTE DE NOTRE RÉPERTOIRE : l'animation porte specialvar1 = son numéro, et le premier tri (CrudeSelection) ne garde
    // que les animations dont specialvar1 égale celui de la commande — le mécanisme des célébrations et du carton. Le corps
    // ne la joue donc jamais de lui-même. Si elle ne peut pas partir maintenant (vitesse, angle, ballon hors d'atteinte), la
    // commande suivante de la file reprend : la conduite d'avant.
    PlayerCommand command;
    command.desiredFunctionType = gi->flags == 1 ? e_FunctionType_Movement : e_FunctionType_BallControl;
    command.useSpecialVar1 = true;
    command.specialVar1 = gi->target;
    Vector3 vers = versLeRepereDe(team, gi->x, gi->y) - player->GetPosition();
    vers.coords[2] = 0.0f;
    command.useDesiredMovement = true;
    command.desiredDirection = vers.GetLength() > 0.1f ? vers.GetNormalized(player->GetDirectionVec()) : player->GetDirectionVec();
    command.desiredVelocityFloat = clamp(gi->speed, idleVelocity, sprintVelocity);
    command.useDesiredLookAt = false;
    commandQueue.push_back(command);
    rawInputDirection = command.desiredDirection;
    rawInputVelocityFloat = command.desiredVelocityFloat;
    return true;
  }
  if (gi->kind == GF_DRIBBLE) {
    Vector3 cible = versLeRepereDe(team, gi->x, gi->y);
    Vector3 vers = cible - player->GetPosition();
    vers.coords[2] = 0.0f;
    rawInputDirection = vers.GetNormalized(player->GetDirectionVec());
    rawInputVelocityFloat = clamp(gi->speed, idleVelocity, sprintVelocity);
    return true;
  }
  return false;
}

// ── C. LE PRESSING ────────────────────────────────────────────────────────────────────────────────────────────────────
// 0 : le contrôleur choisit (chasse s'il est parmi les deux plus proches du porteur) ; 1 : jamais (placement du cerveau) ;
// 2 : toujours (le cerveau l'a élu presseur).
int ElizaController::_GfPressMode() {
  const GfIntent *gi = gf_intent(CastPlayer());
  if (!gi) return 0;
  // PRESS drapeau 1 : le cerveau a élu ce presseur, le corps presse À SA FAÇON (sa chasse : les deux plus proches du porteur
  // vont à leur position de défense côté but, aimantés à portée) — mode 0, la logique du contrôleur
  if (gi->kind == GF_PRESS) return gi->flags == 1 ? 0 : 2;
  return gi->kind == GF_MOVE ? 1 : 0;
}

// ── D. LA GARDE (le face-à-face du cerveau, face.mjs) ──────────────────────────────────────────────────────────────────────────
// ALLER drapeau 1 : le défenseur tient sa garde face au porteur planté et ne va pas au ballon de lui-même — ni contrôle, ni amorti,
// ni intervention, ni tacle glissé. Ses réflexes jugent le duel sur la seule géométrie (CouldWinABallDuelLikeliness : l'adversaire
// est-il entre le ballon et moi ?) ; face à un porteur planté, le ballon devant lui, ils le voient toujours gagnable et le défenseur
// le piquait au premier pas — mesuré : 14 face-à-face sur 27 finis ainsi, pendant la garde. C'est la loi du face-à-face qui décide
// quand il se jette (la fente : PRESSER, les réflexes reviennent) ; la sortie du porteur les lui rend aussi.
bool ElizaController::_GfGarde() {
  const GfIntent *gi = gf_intent(CastPlayer());
  return gi && gi->kind == GF_MOVE && (gi->flags & 1);
}

// Le presseur élu fond sur le porteur adverse : vers sa position anticipée (0,3 s), au sprint, avec l'aimant au ballon et la
// hâte du contrôleur — ce qu'Eliza fait pour son joueur désigné quand il « n'abandonne pas un duel ». Le tacle reste à ses
// réflexes (`_InterfereCommand`, `_SlidingCommand`), dosés par la probabilité de gagner le duel.
void ElizaController::_GfPress(bool &forceMagnet, bool &extraHaste) {
  Player *porteur = match->GetTeam(abs(team->GetID() - 1))->GetDesignatedTeamPossessionPlayer();
  if (!porteur) return;
  Vector3 vers = (porteur->GetPosition() + porteur->GetMovement() * 0.3f) - player->GetPosition();
  vers.coords[2] = 0.0f;
  inputDirection = vers.GetNormalized(inputDirection);
  inputVelocityFloat = sprintVelocity;
  forceMagnet = true;
  extraHaste = true;
}

// ── F. LES TOUCHES EN SÉRIE (le face-à-face : la roulette, la croqueta, le râteau — patch.py, étape 14) ───────────────────────
// Un geste de notre répertoire marqué <gfserie> porte toutes ses touches dans sa ligne football, puis la destination du ballon (sa
// dernière entrée : pas une touche). Le corps n'en connaissait qu'une par animation — des instants CANDIDATS, il en retient un — :
// la première reste la sienne (le tri, la triche, la touche : seule candidate) ; les suivantes sont jouées ici, à leur image.
// Chaque touche envoie le ballon là où l'animation met le pied de la suivante, à son image : la vitesse se cherche sur la
// prédiction du ballon par le corps lui-même (SetMomentum, Predict, par dichotomie) — exacte, frottements de l'herbe compris.
// Le ballon pris ou dévié entre deux touches (à plus de 0,4 m de l'attendu) : la série s'arrête, le corps reprend la main. Un geste
// planté (<gfarret>) range le ballon : sa dernière entrée l'arrête là, sous la semelle ou au bout du tirage.
bool gf_serie(blunted::Animation *anim) {
  return anim->GetVariableCache().specialvar1() >= 100 && !anim->GetVariable("gfserie").empty();
}

// Où l'animation met le ballon à cette image, au monde : le corps (sa racine, décalages de la triche compris), tourné du cap de
// départ et de la rotation ajoutée par le corps (la formule de Process, la rotation avant la touche interdite)
Vector3 Humanoid::_GfBallonAttendu(int frame, const Vector3 &animBall) const {
  Quaternion orientation;
  Vector3 racine;
  currentAnim.anim->GetKeyFrame(BodyPart::player, frame, orientation, racine);
  const int nf = currentAnim.anim->GetEffectiveFrameCount(), tf = currentAnim.touchFrame;
  float debut = std::min(1.0f, (frame + 1) / (float)std::min(16, nf + 1)), fin = debut;
  if (tf != -1) {
    debut = std::min(1.0f, (frame + 1) / (float)std::min(16, tf + 1));
    fin = frame > tf ? (frame - tf) / (float)(nf - tf) : 0.0f;
  }
  const radian rotation = startAngle + currentAnim.rotationSmuggle.begin * (1.0f - debut) + currentAnim.rotationSmuggle.end * fin;
  const int i = std::max(0, std::min(frame, (int)currentAnim.positions.size() - 1));
  const Vector3 corps = startPos + currentAnim.positions.at(i) + currentAnim.actionSmuggleOffset + currentAnim.actionSmuggleSustainOffset + currentAnim.movementSmuggleOffset;
  Vector3 rel = animBall - racine;
  rel.coords[2] = 0.0f;
  Vector3 p = corps + rel.GetRotated2D(rotation);
  p.coords[2] = animBall.coords[2];
  return p;
}

// La vitesse qui mène le ballon, au sol et sans effet, de là où il est à `cible` en `dt_ms` : la dichotomie sur la prédiction du
// corps (Ball::Predict suit sa propre physique : l'air, l'herbe, ses frottements quadratique et linéaire)
Vector3 Humanoid::_GfVitessePour(const Vector3 &cible, int dt_ms) {
  Ball *ballon = match->GetBall();
  const Vector3 depart = ballon->Predict(0);
  const Vector3 vers = (cible - depart).Get2D();
  const float distance = vers.GetLength();
  if (distance < 0.005f || dt_ms <= 0) return Vector3(0);
  const Vector3 u = vers * (1.0f / distance);
  ballon->SetRotation(0, 0, 0, 1.0f);
  float bas = 0.0f, haut = 25.0f;
  for (int k = 0; k < 22; k++) {
    const float s = 0.5f * (bas + haut);
    ballon->SetMomentum(u * s);
    if ((ballon->Predict(dt_ms) - depart).Get2D().GetDotProduct(u) < distance) bas = s; else haut = s;
  }
  return u * (0.5f * (bas + haut));
}

void Humanoid::_GfToucheEnSerie() {
  if (currentAnim.touchFrame < 0 || currentAnim.frameNum < currentAnim.touchFrame || !gf_serie(currentAnim.anim)) return;
  boost::shared_ptr<FootballAnimationExtension> touches = boost::static_pointer_cast<FootballAnimationExtension>(currentAnim.anim->GetExtension("football"));
  const int n = touches->GetTouchCount();
  if (n < 2) return;
  int k = -1;
  Vector3 ici;
  for (int i = 0; i < n - 1 && k < 0; i++) {   // les touches : toutes les entrées sauf la dernière (la destination du ballon)
    Vector3 b;
    int f;
    touches->GetTouch(i, b, f);
    if (f == currentAnim.frameNum) { k = i; ici = b; }
  }
  Ball *ballon = match->GetBall();
  if (k < 0) {
    // LE BALLON RANGÉ (<gfarret> : un geste planté) : à sa dernière entrée, la semelle l'arrête là où le geste le laisse — le geste
    // suivant l'y attend (sinon le contrôle du corps le replaçait à sa distance à lui, et nos touches précoces le manquaient)
    Vector3 b;
    int f;
    touches->GetTouch(n - 1, b, f);
    if (f != currentAnim.frameNum || currentAnim.anim->GetVariable("gfarret").empty() || match->GetLastTouchPlayer() != CastPlayer()) return;
    const float ecart = (ballon->Predict(0) - _GfBallonAttendu(f, b)).Get2D().GetLength();
    if (ecart > 0.2f) { gf_event(GF_EV_SERIE, team->GetID(), CastPlayer()->GetStableID(), -1.0f, (float)f, ecart, 0.0f); return; }
    ballon->SetRotation(0, 0, 0, 1.0f);
    ballon->Touch(Vector3(0));
    gf_event(GF_EV_SERIE, team->GetID(), CastPlayer()->GetStableID(), (float)(n - 1), (float)f, ecart, 0.0f);
    return;
  }
  const float ecart = (ballon->Predict(0) - _GfBallonAttendu(currentAnim.frameNum, ici)).Get2D().GetLength();
  if (k == 0) {
    // la première touche est celle du corps : elle vient d'avoir lieu, par lui — sinon le ballon n'était pas à sa portée
    if (CastPlayer()->GetLastTouchTime_ms() != match->GetActualTime_ms() || match->GetLastTouchPlayer() != CastPlayer()) {
      gf_event(GF_EV_SERIE, team->GetID(), CastPlayer()->GetStableID(), -1.0f, (float)currentAnim.frameNum, ecart, 0.0f);
      return;
    }
  } else if (ecart > 0.4f) {
    gf_event(GF_EV_SERIE, team->GetID(), CastPlayer()->GetStableID(), -1.0f, (float)currentAnim.frameNum, ecart, 0.0f);
    return;   // le ballon n'est plus là où le pied l'attend : pris, dévié — la série s'arrête
  }
  Vector3 suivant;
  int fs;
  touches->GetTouch(k + 1, suivant, fs);
  const Vector3 v = _GfVitessePour(_GfBallonAttendu(fs, suivant), (fs - currentAnim.frameNum) * 10);
  ballon->SetRotation(0, 0, 0, 1.0f);
  ballon->Touch(v);
  if (k > 0) team->SetLastTouchPlayer(CastPlayer(), GetTouchTypeForBodyPart(currentAnim.anim->GetVariable("touch_bodypart")));
  gf_event(GF_EV_SERIE, team->GetID(), CastPlayer()->GetStableID(), (float)k, (float)currentAnim.frameNum, ecart, v.GetLength());
}
