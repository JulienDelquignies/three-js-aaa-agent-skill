#!/bin/sh
# Récupère le moteur de Google Research Football 2.10.2 (third_party/gfootball_engine : licence Unlicense) depuis PyPI
# et le dépose dans upstream/ (non suivi par git), puis applique les correctifs WebAssembly (patch.py, idempotent).
set -e
cd "$(dirname "$0")"
if [ ! -d upstream/src ]; then
  mkdir -p upstream/_dl
  [ -f upstream/_dl/gfootball-2.10.2.tar.gz ] || (cd upstream/_dl && pip download -q --no-deps --no-binary :all: gfootball==2.10.2 -d .)
  tar xzf upstream/_dl/gfootball-2.10.2.tar.gz -C upstream/_dl
  cp -r upstream/_dl/gfootball-2.10.2/third_party/gfootball_engine/src upstream/src
  cp -r upstream/_dl/gfootball-2.10.2/third_party/gfootball_engine/data upstream/data
  cp upstream/_dl/gfootball-2.10.2/third_party/gfootball_engine/LICENSE upstream/LICENSE
fi
python3 patch.py upstream/src
