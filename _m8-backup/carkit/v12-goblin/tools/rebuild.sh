#!/bin/sh
# Rebuild v12-goblin.glb from src/ (run from anywhere). Previews: see render.cjs usage.
set -e
K=$(cd "$(dirname "$0")/.." && pwd)
python3 -I "$K/tools/samples.py" "$K"
python3 -I "$K/tools/textures.py" "$K"
node "$K/tools/build.mjs"
node "$K/tools/inject.mjs"
