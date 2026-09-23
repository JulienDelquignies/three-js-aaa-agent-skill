#!/usr/bin/env bash
# banc-rapide.sh — LE BANC D'UN LOT, EN MINUTES (la demande du 23/09 : « les bancs sont beaucoup trop longs »). Le banc complet
# (verify-match11 en 8 shards + ~45 annexes) coûte ~6 h de CPU sur 4 cœurs : il se joue désormais PAR GROUPE de lots (3-4), ses rouges
# prouvés à la base du groupe et épinglés en une fois. Chaque lot joue ce banc-ci : le jumeau (la clé nulle = le monde d'hier au
# bit), le budget (bloc 1), les blocs du lot, les SENTINELLES (liste tenue dans banc-sentinelles.txt, choisies sur le profil
# BANC_TEMPS du dernier banc complet), et la synchronisation des trois copies du moteur.
#   usage : banc-rapide.sh '<json des clés nulles du lot>' <indices des blocs du lot, séparés par des virgules>
set -u
cd "$(dirname "$0")"
CLES=${1:-'{}'}; BLOCS=${2:-}
SENT=$(grep -v '^#' banc-sentinelles.txt 2>/dev/null | tr -s ' \n' ',' | sed 's/^,//;s/,$//')
LISTE=$(echo "1,${BLOCS},${SENT}" | tr ',' '\n' | grep -v '^$' | sort -n | uniq | paste -sd, -)
echo "== jumeau (clé nulle $CLES) contre le défaut :"; node book/fingerprint-ov.mjs "$CLES"; node book/fingerprint-ov.mjs '{}'
echo "== blocs $LISTE :"
N=$(echo "$LISTE" | tr ',' '\n' | wc -l); P=4
echo "$LISTE" | tr ',' '\n' | xargs -P "$P" -I{} sh -c 'BANC_BLOCS={} node verify-match11.mjs > /tmp/banc-rapide-{}.log 2>&1; echo "bloc {} : $(tail -1 /tmp/banc-rapide-{}.log)"; grep "^✗" /tmp/banc-rapide-{}.log | cut -c1-200'
echo "== sync :"; node verify-sync.mjs 2>&1 | tail -1
