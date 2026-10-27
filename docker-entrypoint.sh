#!/bin/sh
# Starts as root only to prepare the data folder, then runs Encore as the unprivileged "node" user.
# Railway (and most hosts) mount persistent volumes owned by root, so the app couldn't write its
# SQLite cache otherwise.
set -e
mkdir -p "$DATA_DIR"
chown -R node:node "$DATA_DIR"
export HOME=/home/node
run_as_node() { setpriv --reuid=node --regid=node --init-groups "$@"; }
# Hackathon keys only work against the hackathon API; the harness defaults to production.
run_as_node qloo config set base-url https://hackathon.api.qloo.com > /dev/null
exec setpriv --reuid=node --regid=node --init-groups "$@"
