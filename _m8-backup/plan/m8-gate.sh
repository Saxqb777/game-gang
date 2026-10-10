set -e
pnpm check
pnpm build
fail=0
grep -rniE 'tilt|gyro|deviceorientation|requestPermission' client/src server/src shared/src && fail=1
grep -rnE "ITEM_|ItemKind|itemIcons|ItemVisuals|requestUse|spinOut|mystery|nitro|BOOSTS|placeBoostPads|driftLevel|GAME_MODES|GameMode\b" client/src shared/src server/src && fail=1
grep -rni corniche client/src shared/src server/src && fail=1
[ "$fail" = 0 ] || { echo "M8 gate: retired words found (listed above)"; exit 1; }
echo "M8 gate: PASS"
