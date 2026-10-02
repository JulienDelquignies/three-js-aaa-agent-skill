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
  if new in s and old not in s: return
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
print('patch: ok')
