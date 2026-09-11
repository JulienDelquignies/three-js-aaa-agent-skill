#!/bin/bash
# usage: blocidx.sh '<motif>' → l'index BANC_SHARD du bloc contenant la première ligne qui matche
V=/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/scripts/verify-match11.mjs
L=$(grep -n -F -- "$1" $V | head -1 | cut -d: -f1); [ -z "$L" ] && { echo "?"; exit 1; }
echo $(( $(head -n $((L-1)) $V | grep -c "if (__bloc())") - 1 ))
