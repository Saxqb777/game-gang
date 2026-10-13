set -e
pnpm check
pnpm build
fail=0
grep -rniE 'tilt|gyro|deviceorientation|requestPermission' client/src server/src shared/src && fail=1
grep -rnE "ITEM_|ItemKind|itemIcons|ItemVisuals|requestUse|spinOut|mystery|nitro|BOOSTS|placeBoostPads|driftLevel|GAME_MODES|GameMode\b" client/src shared/src server/src && fail=1
grep -rni corniche client/src shared/src server/src && fail=1
grep -rniE '\b(goblin|ariel|strix|supra|bmw|michelin|bridgestone|potenza|brembo|streamside|pagani|zonda|lamborghini|koenigsegg|ferrari|porsche|ford|capri|mustang|challenger|cuda|mopar|corvette|aston|jaguar|toyota|nissan|datsun|celica|renault|bbs|gti|carplay|spotify|forza)\b' client/src shared/src server/src --exclude=carCredits.ts && fail=1
[ "$fail" = 0 ] || { echo "Cars gate: forbidden words found (listed above)"; exit 1; }
echo "Cars gate: PASS"
