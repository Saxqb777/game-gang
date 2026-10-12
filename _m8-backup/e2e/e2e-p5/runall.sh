#!/bin/sh
# Runs P5 browser scenarios one after another, each under the shared browser lock.
cd /tmp/claude-0/e2e-p5
for m in "$@"; do
  flock /tmp/claude-0/m8-browser.lock node p5acc.cjs $m > p5acc-$m.log 2>&1
  echo "done $m $(grep -c FAIL p5acc-$m.log) fails"
done
