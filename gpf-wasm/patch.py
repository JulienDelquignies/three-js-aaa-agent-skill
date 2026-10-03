# Les correctifs WebAssembly du moteur de Google Research Football — idempotents (chaque remplacement vérifie son état).
# Principe : ne rien changer au comportement du jeu ; seulement remplacer ce que le navigateur n'a pas.
#   boost::filesystem → std::filesystem (C++17, le système de fichiers en mémoire d'Emscripten le sert)
#   boost::condition  → std::condition_variable_any (le moteur tourne sur un seul fil en mode sans rendu)
#   le rendu OpenGL    → le MockRenderer3D du mode sans rendu, toujours
#   les traces de pile (execinfo, glibc) → rien
import sys, re, pathlib
SRC = pathlib.Path(sys.argv[1])
def sub(rel, old, new, count=1):
  p = SRC / rel; s = p.read_text()
  if new in s: return  # déjà appliqué (le nouveau texte peut contenir l'ancien : un ajout après une ligne)
  if old not in s: raise SystemExit(f'patch: motif absent dans {rel}: {old[:60]!r}')
  p.write_text(s.replace(old, new, count) if count else s.replace(old, new))
def ensure_top(rel, line):
  p = SRC / rel; s = p.read_text()
  if line not in s: p.write_text(line + '\n' + s)

# 1. le système de fichiers
for rel in ('cmake/file.h', 'cmake/file.cpp', 'base/utils.cpp'):
  p = SRC / rel; s = p.read_text()
  s2 = s.replace('boost::filesystem', 'std::filesystem').replace('#include <boost/filesystem.hpp>', '#include <filesystem>')
  if s2 != s: p.write_text(s2)
ensure_top('cmake/file.h', '#include <filesystem>')
ensure_top('base/utils.cpp', '#include <filesystem>')

# 2. les fils d'exécution
for rel in ('types/messagequeue.hpp', 'types/command.hpp', 'defines.hpp'):
  p = SRC / rel; s = p.read_text()
  s2 = s.replace('#include <boost/thread/condition.hpp>', '#include <condition_variable>\n#include <mutex>').replace('boost::condition ', 'std::condition_variable_any ')
  if s2 != s: p.write_text(s2)

# 3. le rendu : toujours le rendu factice
sub('systems/graphics/graphics_system.cpp', 'renderer3DTask = new OpenGLRenderer3D();', '''#ifndef __EMSCRIPTEN__
    renderer3DTask = new OpenGLRenderer3D();
#else
    renderer3DTask = new MockRenderer3D();
#endif''')
p = SRC / 'systems/graphics/graphics_system.cpp'; s = p.read_text()
if '#include "rendering/opengl_renderer3d.hpp"' in s and '#ifndef __EMSCRIPTEN__\n#include "rendering/opengl_renderer3d.hpp"' not in s:
  p.write_text(s.replace('#include "rendering/opengl_renderer3d.hpp"', '#ifndef __EMSCRIPTEN__\n#include "rendering/opengl_renderer3d.hpp"\n#endif'))

# 4. les traces de pile
p = SRC / 'cmake/backtrace.cpp'; s = p.read_text()
if '__EMSCRIPTEN__' not in s:
  p.write_text('#ifdef __EMSCRIPTEN__\n#include "backtrace.h"\nvoid print_stacktrace() {}\nvoid install_stacktrace() {}\n#else\n' + s + '\n#endif\n')

# 5. la vitesse du chrono, réglable (le moteur la fige à 0,027 = ×18 ; 4,75 = 90 vraies minutes)
sub('game_env.cpp', 'config->Set("match_duration", 0.027);', '{ const char* md = getenv("GFOOTBALL_MATCH_DURATION"); config->Set("match_duration", md ? atof(md) : 0.027); }')
# 6. LE CERVEAU EXTERNE (lot L2) : trois lectures des intentions dans le contrôleur, et le journal des événements.
#    Sans intention posée, chaque lecture rend la main au code d'origine : le match est identique au bit près.
sub('onthepitch/player/controller/elizacontroller.hpp',
    '    void _AddCelebration(std::vector<PlayerCommand> &commandQueue);',
    '''    void _AddCelebration(std::vector<PlayerCommand> &commandQueue);
    // [gf-intent] les lectures du cerveau externe (api/intents.cpp)
    void _GfPlacement(Vector3 &rawInputDirection, float &rawInputVelocityFloat);
    bool _GfOnBall(std::vector<PlayerCommand> &commandQueue, Vector3 &rawInputDirection, float &rawInputVelocityFloat);
    int _GfPressMode();
    void _GfPress(bool &forceMagnet, bool &extraHaste);''')
ensure_top('onthepitch/player/controller/elizacontroller.cpp', '#include "intents.hpp"')
# A — le placement sans ballon
sub('onthepitch/player/controller/elizacontroller.cpp',
    '''      offenseStrategy.RequestInput(this, _mentalImage, rawInputDirection,
                                   rawInputVelocityFloat);
    }
''',
    '''      offenseStrategy.RequestInput(this, _mentalImage, rawInputDirection,
                                   rawInputVelocityFloat);
    }
    _GfPlacement(rawInputDirection, rawInputVelocityFloat);  // [gf-intent] A
''')
# B — la décision du porteur
sub('onthepitch/player/controller/elizacontroller.cpp',
    '''      GetOnTheBallCommands(commandQueue, rawInputDirection, rawInputVelocityFloat);
    }
    extraHaste = false;''',
    '''      if (!_GfOnBall(commandQueue, rawInputDirection, rawInputVelocityFloat))  // [gf-intent] B
        GetOnTheBallCommands(commandQueue, rawInputDirection, rawInputVelocityFloat);
    }
    extraHaste = false;''')
# C — le pressing : le presseur élu fond sur le porteur (aimant au ballon, hâte) ; un joueur en placement ne chasse pas
sub('onthepitch/player/controller/elizacontroller.cpp',
    '''      } else if (!teamHasBestPossession && !CastPlayer()->GetManMarking() &&
                 ((opp->GetPosition() + opp->GetMovement() * 0.12f) -
                  (CastPlayer()->GetPosition() +
                   CastPlayer()->GetMovement() * 0.04f))
                         .GetLength() < huntDistanceThreshold) {''',
    '''      } else if (_GfPressMode() == 2) {  // [gf-intent] C : le presseur élu
        _GfPress(forceMagnet, extraHaste);
      } else if (_GfPressMode() != 1 &&  // [gf-intent] C : un joueur en placement ne chasse pas
                 !teamHasBestPossession && !CastPlayer()->GetManMarking() &&
                 ((opp->GetPosition() + opp->GetMovement() * 0.12f) -
                  (CastPlayer()->GetPosition() +
                   CastPlayer()->GetMovement() * 0.04f))
                         .GetLength() < huntDistanceThreshold) {''')
# le journal : touches, buts, fautes, hors-jeu, coups de pied arrêtés
ensure_top('onthepitch/team.cpp', '#include "intents.hpp"')
sub('onthepitch/team.cpp',
    '''  match->SetLastTouchTeamID(GetID(), touchType);
}''',
    '''  match->SetLastTouchTeamID(GetID(), touchType);
  gf_event(GF_EV_TOUCH, GetID(), player->GetStableID(), (float)touchType, (float)player->GetCurrentFunctionType());  // [gf-intent]
}''')
ensure_top('onthepitch/match.cpp', '#include "intents.hpp"')
sub('onthepitch/match.cpp',
    '''          SpamMessage("It's an OWN GOAL! oh noes!", 4000);
        }
      }
''',
    '''          SpamMessage("It's an OWN GOAL! oh noes!", 4000);
        }
      }
      gf_event(GF_EV_GOAL, GetLastGoalTeam()->GetID(), lastGoalScorer ? lastGoalScorer->GetStableID() : -1, ownGoal ? 1.0f : 0.0f);  // [gf-intent]
''')
ensure_top('onthepitch/referee.cpp', '#include "intents.hpp"')
sub('onthepitch/referee.cpp',
    '''    match->SpamMessage(spamMessage);

    foul.hasBeenProcessed = true;
''',
    '''    match->SpamMessage(spamMessage);
    gf_event(GF_EV_FOUL, foul.foulPlayer->GetTeam()->GetID(), foul.foulPlayer->GetStableID(), (float)foul.foulType,
             foul.foulVictim ? (float)foul.foulVictim->GetStableID() : -1.0f, penalty ? 1.0f : 0.0f);  // [gf-intent]

    foul.hasBeenProcessed = true;
''')
sub('onthepitch/referee.cpp',
    '''          match->SpamMessage("offside!");''',
    '''          match->SpamMessage("offside!");
          gf_event(GF_EV_OFFSIDE, ballOwner->GetTeam()->GetID(), ballOwner->GetStableID());  // [gf-intent]''')
sub('onthepitch/referee.cpp',
    '''  buffer.taker = match->GetTeam(buffer.teamID)->GetController()->GetPieceTaker();''',
    '''  buffer.taker = match->GetTeam(buffer.teamID)->GetController()->GetPieceTaker();
  gf_event(GF_EV_SETPIECE, buffer.teamID, buffer.taker ? buffer.taker->GetStableID() : -1, (float)setPiece);  // [gf-intent]''')
# la passe au contact : le destinataire que le corps vise vraiment (il peut corriger celui de la commande de 0,15 π) et la
# force de la touche — de quoi juger une passe perdue sans la deviner
ensure_top('onthepitch/player/humanoid/humanoid.cpp', '#include "intents.hpp"')
sub('onthepitch/player/humanoid/humanoid.cpp',
    '''        match->GetBall()->SetRotation(xRot, yRot, zcurve, 0.9f * (1.0f - bumpyRideBias));

        team->SetLastTouchPlayer(CastPlayer(), GetTouchTypeForBodyPart(currentAnim.anim->GetVariable("touch_bodypart")));
      }

      else if (currentAnim.functionType == e_FunctionType_Shot) {''',
    '''        match->GetBall()->SetRotation(xRot, yRot, zcurve, 0.9f * (1.0f - bumpyRideBias));

        gf_event(GF_EV_PASS, team->GetID(), CastPlayer()->GetStableID(), (float)currentAnim.functionType,
                 targetPlayer ? (float)targetPlayer->GetStableID() : -1.0f, touchVec.GetLength(),
                 currentAnim.originatingCommand.touchInfo.forcedTargetPlayer
                     ? (float)currentAnim.originatingCommand.touchInfo.forcedTargetPlayer->GetStableID() : -1.0f);  // [gf-intent]
        team->SetLastTouchPlayer(CastPlayer(), GetTouchTypeForBodyPart(currentAnim.anim->GetVariable("touch_bodypart")));
      }

      else if (currentAnim.functionType == e_FunctionType_Shot) {''')
# 7. LES ATTRIBUTS DES JOUEURS, réglables de l'extérieur (gf_set_stat) : la porte par laquelle les attributs de la carrière
#    pilotent le corps (lot L3), et le réglage du duel tireur-gardien (lot L2). Sans appel, rien ne change.
sub('data/playerdata.hpp',
    '''    inline float GetStat(PlayerStat name) const { return stats.GetReal(name); }''',
    '''    inline float GetStat(PlayerStat name) const { return stats.GetReal(name); }
    void SetStat(PlayerStat name, float value) { stats.Set(name, value); UpdateValues(); }  // [gf-intent]''')
# 8. L'HORLOGE DU MATCH : à chaque arrêt de jeu, l'arbitre avance l'horloge de la vraie durée de la remise (api/intents.hpp,
#    gf_arret_ms ; 0 par défaut). Sept arrêts : but, corner, six-mètres, touche, hors-jeu, faute, penalty — pas la mi-temps.
sub('onthepitch/referee.cpp',
    '          buffer.desiredSetPiece = e_GameMode_KickOff;\n          buffer.stopTime = match->GetActualTime_ms();\n          // Number of ms for replay.',
    "          buffer.desiredSetPiece = e_GameMode_KickOff;\n          buffer.stopTime = match->GetActualTime_ms();\n          match->BumpActualTime_ms(gf_arret_ms(e_GameMode_KickOff));  // [gf-intent] l'horloge du match\n          // Number of ms for replay.")
sub('onthepitch/referee.cpp',
    '          buffer.desiredSetPiece = e_GameMode_Corner;\n          buffer.stopTime = match->GetActualTime_ms();',
    "          buffer.desiredSetPiece = e_GameMode_Corner;\n          buffer.stopTime = match->GetActualTime_ms();\n          match->BumpActualTime_ms(gf_arret_ms(e_GameMode_Corner));  // [gf-intent] l'horloge du match")
sub('onthepitch/referee.cpp',
    '          buffer.desiredSetPiece = e_GameMode_GoalKick;\n          buffer.stopTime = match->GetActualTime_ms();',
    "          buffer.desiredSetPiece = e_GameMode_GoalKick;\n          buffer.stopTime = match->GetActualTime_ms();\n          match->BumpActualTime_ms(gf_arret_ms(e_GameMode_GoalKick));  // [gf-intent] l'horloge du match")
sub('onthepitch/referee.cpp',
    '          buffer.desiredSetPiece = e_GameMode_ThrowIn;\n          buffer.stopTime = match->GetActualTime_ms();',
    "          buffer.desiredSetPiece = e_GameMode_ThrowIn;\n          buffer.stopTime = match->GetActualTime_ms();\n          match->BumpActualTime_ms(gf_arret_ms(e_GameMode_ThrowIn));  // [gf-intent] l'horloge du match")
sub('onthepitch/referee.cpp',
    '          match->StopPlay();\n          buffer.desiredSetPiece = e_GameMode_FreeKick;\n          buffer.stopTime = match->GetActualTime_ms();',
    "          match->StopPlay();\n          buffer.desiredSetPiece = e_GameMode_FreeKick;\n          buffer.stopTime = match->GetActualTime_ms();\n          match->BumpActualTime_ms(gf_arret_ms(e_GameMode_FreeKick));  // [gf-intent] l'horloge du match")
sub('onthepitch/referee.cpp',
    '      DO_VALIDATION;\n      buffer.desiredSetPiece = e_GameMode_FreeKick;\n      buffer.stopTime = match->GetActualTime_ms();',
    "      DO_VALIDATION;\n      buffer.desiredSetPiece = e_GameMode_FreeKick;\n      buffer.stopTime = match->GetActualTime_ms();\n      match->BumpActualTime_ms(gf_arret_ms(e_GameMode_FreeKick));  // [gf-intent] l'horloge du match")
sub('onthepitch/referee.cpp',
    '      buffer.desiredSetPiece = e_GameMode_Penalty;\n      buffer.stopTime = match->GetActualTime_ms();',
    "      buffer.desiredSetPiece = e_GameMode_Penalty;\n      buffer.stopTime = match->GetActualTime_ms();\n      match->BumpActualTime_ms(gf_arret_ms(e_GameMode_Penalty));  // [gf-intent] l'horloge du match")
# 9. LES FAUTES DU CERVEAU : la Loi 12 de notre cerveau (l'accrochage du battu, le carton jugé sur la nature de la faute,
#    l'avantage) décide ; l'arbitre du corps siffle (gf_faute → CheckFoul : arrêt, coup franc ou penalty, carton) ou montre
#    le carton sans arrêter le jeu (gf_carton, l'avantage joué). Le corps ne sifflait que les contacts de ses tacles.
sub('onthepitch/referee.hpp',
    '''    bool CheckFoul();''',
    '''    bool CheckFoul();
    void GfFaute(Player *fautif, Player *victime, int gravite, const Vector3 &lieu);  // [gf-intent] la faute du cerveau externe''')
sub('onthepitch/referee.cpp',
    '''void Referee::ProcessState(EnvState *state) {''',
    '''// [gf-intent] LA FAUTE DÉCIDÉE PAR LE CERVEAU EXTERNE (api/gf_api.cpp, gf_faute) : posée comme celles des tacles, sans
// avantage (le cerveau l'a déjà joué) — CheckFoul l'administre au pas suivant : arrêt, coup franc ou penalty, carton. Le LIEU
// est celui de la faute (monde) : la victime a pu courir pendant l'avantage, entrer dans la surface — ce n'est pas un penalty.
void Referee::GfFaute(Player *fautif, Player *victime, int gravite, const Vector3 &lieu) {
  if (buffer.active || !match->IsInPlay() || match->IsInSetPiece() || !fautif || !victime) return;
  foul.foulType = gravite;
  foul.advantage = false;
  foul.foulPlayer = fautif;
  foul.foulVictim = victime;
  foul.foulTime = match->GetActualTime_ms();
  foul.foulPosition = lieu;
  foul.hasBeenProcessed = false;
}

void Referee::ProcessState(EnvState *state) {''')
# 10. LE RELEVÉ DES ANIMATIONS (api/intents.hpp, bancs/animations.mjs) : chaque choix d'animation compte — candidate au tri
#     grossier, gardée après les filtres de direction, jouée (joueur ou officiel). Un compteur : le match n'en dépend pas.
ensure_top('onthepitch/player/humanoid/humanoidbase.cpp', '#include "intents.hpp"')
sub('onthepitch/player/humanoid/humanoid.cpp',
    '''  DataSet dataSet;
  anims->CrudeSelection(dataSet, query);
  if (dataSet.size() == 0) {''',
    '''  DataSet dataSet;
  anims->CrudeSelection(dataSet, query);
  for (int id : dataSet) gf_anim_compte(0, id);  // [gf-intent] le relevé des animations
  if (dataSet.size() == 0) {''')
sub('onthepitch/player/humanoid/humanoid.cpp',
    '''  GetContext().tracker_disabled++;
  std::stable_sort(dataSet.begin(), dataSet.end(), boost::bind(&Humanoid::ComparePriorityVariable, this, _1, _2));''',
    '''  for (int id : dataSet) gf_anim_compte(1, id);  // [gf-intent] le relevé des animations
  GetContext().tracker_disabled++;
  std::stable_sort(dataSet.begin(), dataSet.end(), boost::bind(&Humanoid::ComparePriorityVariable, this, _1, _2));''')
sub('onthepitch/player/humanoid/humanoid.cpp',
    '''    currentAnim.anim = anims->GetAnim(selectedAnimID);
    currentAnim.id = selectedAnimID;''',
    '''    currentAnim.anim = anims->GetAnim(selectedAnimID);
    currentAnim.id = selectedAnimID;
    gf_anim_compte(2, selectedAnimID);  // [gf-intent] le relevé des animations''')
sub('onthepitch/player/humanoid/humanoidbase.cpp',
    '''    currentAnim.anim = anims->GetAnim(selectedAnimID);
    currentAnim.id = selectedAnimID;''',
    '''    currentAnim.anim = anims->GetAnim(selectedAnimID);
    currentAnim.id = selectedAnimID;
    gf_anim_compte(3, selectedAnimID);  // [gf-intent] le relevé des animations''')
# 11. LE GESTE VOULU TOUCHE LE BALLON (intention GESTE, api/intents.cpp) : à l'arrêt, ballon arrêté au pied, le corps juge qu'une touche
#     est inutile (NeedTouch : « when idle, don't want to touch the ball every frame ») — or le face-à-face n'est fait que de touches
#     à l'arrêt (semelle, roulé, tiré, croqueta). Une commande de notre répertoire (specialVar1 ≥ 100, posé par la seule intention
#     GESTE) veut sa touche. Sans elle, rien ne change.
sub('onthepitch/player/humanoid/humanoid.cpp',
    '''bool Humanoid::NeedTouch(int animID, const PlayerCommand &command) {
  DO_VALIDATION;''',
    '''bool Humanoid::NeedTouch(int animID, const PlayerCommand &command) {
  DO_VALIDATION;
  if (command.useSpecialVar1 && command.specialVar1 >= 100) return true;  // [gf-intent] un geste de notre répertoire''')
# 12. LE JOURNAL DIT QUAND UN GESTE DE NOTRE RÉPERTOIRE DÉMARRE (GF_EV_GESTE) : le face-à-face du cerveau juge la morsure au contact
#     de la feinte — il lui faut l'instant où le corps l'a vraiment lancée. Noté au relevé des animations (étape 10).
sub('onthepitch/player/humanoid/humanoid.cpp',
    '''    gf_anim_compte(2, selectedAnimID);  // [gf-intent] le relevé des animations''',
    '''    gf_anim_compte(2, selectedAnimID);  // [gf-intent] le relevé des animations
    { const int sv = currentAnim.anim->GetVariableCache().specialvar1(); if (sv >= 100) gf_event(GF_EV_GESTE, team->GetID(), CastPlayer()->GetStableID(), (float)sv); }  // [gf-intent] le geste''')
# 13. LA GARDE DU FACE-À-FACE (intention ALLER drapeau 1, api/intents.cpp) : le défenseur tient sa distance face au porteur planté.
#     Ses réflexes de duel (contrôle, amorti, intervention, tacle glissé) jugent le ballon gagnable sur la seule géométrie
#     (« l'adversaire est-il entre le ballon et moi ? ») : face à un porteur planté, ballon devant lui, toujours — il le piquait au
#     premier pas. Ils se taisent pendant la garde ; la fente du cerveau (PRESSER) et la sortie du porteur les lui rendent.
sub('onthepitch/player/controller/elizacontroller.hpp',
    '''    void _GfPress(bool &forceMagnet, bool &extraHaste);''',
    '''    void _GfPress(bool &forceMagnet, bool &extraHaste);
    bool _GfGarde();''')
sub('onthepitch/player/controller/elizacontroller.cpp',
    '''  if (match->IsInPlay() && !match->IsInSetPiece()) {
    DO_VALIDATION;

    // ball control?
    _BallControlCommand(commandQueue, false, false, false); // last param true == enable sticky run direction.''',
    '''  if (match->IsInPlay() && !match->IsInSetPiece() && !_GfGarde()) {  // [gf-intent] D : la garde du face-à-face
    DO_VALIDATION;

    // ball control?
    _BallControlCommand(commandQueue, false, false, false); // last param true == enable sticky run direction.''')
# 14. LES TOUCHES EN SÉRIE D'UN GESTE DE NOTRE RÉPERTOIRE (<gfserie> : la roulette, la croqueta, le râteau — api/intents.cpp) : le corps
#     ne connaît qu'une touche par animation (ses touches sont des instants CANDIDATS, il en retient un). Un geste en série porte
#     toutes les siennes dans sa ligne football, puis la destination du ballon : la première seule est candidate (le tri, la triche),
#     les suivantes sont jouées à leur image ; et sa racine est suivie telle quelle — le pivot sur l'appui, la course de sortie —,
#     sans la physique des déplacements (qui l'aurait lissée : l'appui glissait). Sans <gfserie> (specialvar1 ≥ 100), rien ne change.
sub('onthepitch/player/humanoid/humanoid.hpp',
    '''    Vector3 GetBestPossibleTouch(const Vector3 &desiredTouch, e_FunctionType functionType);''',
    '''    Vector3 GetBestPossibleTouch(const Vector3 &desiredTouch, e_FunctionType functionType);
    // [gf-intent] les touches en série d'un geste de notre répertoire (api/intents.cpp, étape 14)
    void _GfToucheEnSerie();
    Vector3 _GfBallonAttendu(int frame, const Vector3 &animBall) const;
    Vector3 _GfVitessePour(const Vector3 &cible, int dt_ms);''')
ensure_top('onthepitch/player/humanoid/humanoid.cpp', '#include "intents.hpp"')
sub('onthepitch/player/humanoid/humanoid.cpp',
    '''  if (match->GetBallRetainer() == player) {
    DO_VALIDATION;
    if ((currentAnim.touchFrame <= currentAnim.frameNum &&''',
    '''  _GfToucheEnSerie();  // [gf-intent] étape 14 : les touches suivantes d'un geste en série

  if (match->GetBallRetainer() == player) {
    DO_VALIDATION;
    if ((currentAnim.touchFrame <= currentAnim.frameNum &&''')
sub('onthepitch/player/humanoid/humanoid.cpp',
    '''    int totalTouches = footballExtension->GetTouchCount();''',
    '''    int totalTouches = footballExtension->GetTouchCount();
    if (gf_serie(anim)) totalTouches = 1;  // [gf-intent] étape 14 : un geste en série se choisit sur sa première touche''')
ensure_top('onthepitch/player/humanoid/humanoidbase.cpp', '#include "intents.hpp"')
sub('onthepitch/player/humanoid/humanoidbase.cpp',
    '''Vector3 HumanoidBase::CalculatePhysicsVector(Animation *anim, bool useDesiredMovement, const Vector3 &desiredMovement, bool useDesiredBodyDirection, const Vector3 &desiredBodyDirectionRel, std::vector<Vector3> &positions_ret, radian &rotationOffset_ret) const {

  positions_ret.clear();''',
    '''Vector3 HumanoidBase::CalculatePhysicsVector(Animation *anim, bool useDesiredMovement, const Vector3 &desiredMovement, bool useDesiredBodyDirection, const Vector3 &desiredBodyDirectionRel, std::vector<Vector3> &positions_ret, radian &rotationOffset_ret) const {

  positions_ret.clear();
  // [gf-intent] étape 14 : un geste en série suit sa racine telle quelle — le pivot sur l'appui, la course de sortie
  if (gf_serie(anim)) {
    const std::vector<Vector3> &racine = match->GetAnimPositionCache(anim);
    for (unsigned int f = 0; f < racine.size(); f++) positions_ret.push_back((racine[f] - racine[0]).GetRotated2D(spatialState.angle));
    rotationOffset_ret = 0;
    return anim->GetOutgoingMovement().GetRotated2D(spatialState.angle);
  }''')
print('patch: ok')
