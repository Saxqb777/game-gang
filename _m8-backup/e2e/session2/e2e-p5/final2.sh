#!/bin/sh
cd /tmp/claude-0/e2e-p5
flock /tmp/claude-0/m8-browser.lock node heroes.cjs hero2 brow=1022,windhover=1330,beck=2262,beck-bridge=2290 > hero2.log 2>&1
echo "done hero2 $(grep -c FAIL hero2.log) fails"
for m in views4 views2 views3 gravel bench race; do
  flock /tmp/claude-0/m8-browser.lock node p5acc.cjs $m > p5acc-$m.log 2>&1
  echo "done $m $(grep -c FAIL p5acc-$m.log) fails"
done
