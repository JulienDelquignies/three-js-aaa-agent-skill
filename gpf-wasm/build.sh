#!/bin/bash
# Compile le moteur de Google Research Football (sans rendu) en WebAssembly : objets en parallèle, puis édition de liens.
# Sortie : out/gpf.mjs + out/gpf.wasm (+ out/gpf.data : les données préchargées). Prérequis : source ~/emsdk/emsdk_env.sh
set -e
cd "$(dirname "$0")"
# Les exceptions C++ en instructions WebAssembly natives (forme « legacy » : Chrome 95, Firefox 100, Safari 15.2) plutôt que leur
# émulation en JavaScript (les trampolines invoke_*) : −12 % par pas, −28 % au démarrage, module plus léger, même match au bit
# (A/B du 2 octobre). EH=js reconstruit l'émulation, dans des dossiers à part (build/obj-js, out-js).
if [ "$EH" = js ]; then EHF="-fexceptions"; EHL="-fexceptions"; SUF=-js; else EHF="-fwasm-exceptions -sWASM_LEGACY_EXCEPTIONS=1"; EHL="$EHF"; SUF=; fi
SRC=upstream/src; OBJ=build/obj$SUF; OUT=out$SUF; mkdir -p $OBJ $OUT
FLAGS="-std=c++17 -O3 -DNDEBUG $EHF -sUSE_SDL=2 -sUSE_SDL_IMAGE=2 -sUSE_SDL_TTF=2 -sUSE_BOOST_HEADERS=1 -I$SRC -I$SRC/cmake -Iapi -Wno-everything"
# les sources : tout le moteur, sauf le rendu OpenGL et le client réseau
SOURCES=$(find $SRC -name '*.cpp' ! -path '*rendering/opengl_renderer3d.cpp' ! -name 'client.cpp' | sort)
SOURCES="$SOURCES $(ls api/*.cpp 2>/dev/null || true)"
echo "$SOURCES" | tr ' ' '\n' | grep -c cpp | xargs echo "sources :"
compile() { o=$OBJ/$(echo "$1" | sed 's#[/.]#_#g').o; if [ ! -f "$o" ] || [ "$1" -nt "$o" ]; then em++ $FLAGS -c "$1" -o "$o" 2> "$o.err" || { echo "ÉCHEC $1"; return 0; }; fi; rm -f "$o.err"; }
export -f compile; export FLAGS OBJ
echo "$SOURCES" | tr ' ' '\n' | grep cpp | xargs -P ${JOBS:-6} -I{} bash -c 'compile {}'
ls $OBJ/*.err 2>/dev/null | wc -l | xargs echo "fichiers en erreur :"
# l'édition de liens : un module ES (navigateur, Worker et Node pour les bancs), la mémoire extensible, les données préchargées
[ -n "$(ls $OBJ/*.err 2>/dev/null)" ] && { echo "édition de liens annulée : erreurs de compilation"; exit 1; }
[ -d build/data ] || ./data.sh
em++ $OBJ/*.o -O3 $EHL -sUSE_SDL=2 -sUSE_SDL_IMAGE=2 -sUSE_SDL_TTF=2 \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=GpfModule -sENVIRONMENT=web,worker,node \
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=134217728 -sSTACK_SIZE=4194304 \
  -sEXPORTED_FUNCTIONS=_gf_init,_gf_reset,_gf_step,_gf_frame,_gf_pose,_gf_frame_head,_gf_frame_per,_gf_pose_per,_malloc,_free \
  -sEXPORTED_RUNTIME_METHODS=HEAPF32,FS,ccall,cwrap \
  --preload-file build/data@/data \
  -o $OUT/gpf.mjs
ls -la $OUT/
