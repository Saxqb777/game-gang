#!/bin/sh
# usage: serve.sh <dir>  (viewer on port 5100)
[ -f /tmp/claude-0/e2e-c2/viewer.pid ] && kill $(cat /tmp/claude-0/e2e-c2/viewer.pid) 2>/dev/null
sleep 0.5
nohup node /tmp/claude-0/e2e-c2/viewer/server.cjs 5100 "$1" > /dev/null 2>&1 &
echo $! > /tmp/claude-0/e2e-c2/viewer.pid
sleep 0.5
