#!/bin/sh
# Final P5 browser pass, one scenario at a time under the shared browser lock.
cd /tmp/claude-0/e2e-p5
flock /tmp/claude-0/m8-browser.lock node heroes.cjs hero t1-millrace=268,t1-apex=305,brow=1022,windhover=1330,kestrel=1715,kestrel-exit=1830,beck=2262,hollow=2468,switchback=3036,switchback-exit=3105 > hero.log 2>&1
echo "done hero $(grep -c FAIL hero.log) fails"
for m in views4 views2 views3 gravel bench race; do
  flock /tmp/claude-0/m8-browser.lock node p5acc.cjs $m > p5acc-$m.log 2>&1
  echo "done $m $(grep -c FAIL p5acc-$m.log) fails"
done
