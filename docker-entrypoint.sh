#!/bin/sh
# Prepares the data folder and the Qloo harness, then runs Encore as the unprivileged "node" user.
# - Started as root (Railway, Render, plain Docker): volumes are often mounted owned by root, so give
#   the data folder to "node", then drop root.
# - Started as a regular user (Hugging Face Spaces runs containers as uid 1000, which is "node" in
#   this image): nothing to chown; just run.
set -e
export HOME=/home/node
mkdir -p "$DATA_DIR"
if [ "$(id -u)" = "0" ]; then
  chown -R node:node "$DATA_DIR"
  as_node() { setpriv --reuid=node --regid=node --init-groups "$@"; }
else
  as_node() { "$@"; }
fi
# Hackathon keys only work against the hackathon API; the harness defaults to production.
as_node qloo config set base-url https://hackathon.api.qloo.com > /dev/null
if [ "$(id -u)" = "0" ]; then
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi
exec "$@"
