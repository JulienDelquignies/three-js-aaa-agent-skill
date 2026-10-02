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
print('patch: ok')
