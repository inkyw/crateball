#!/bin/sh
# Runs a command on the production server over SSH. Connection details come from .deploy.env
# (gitignored; see deploy/deploy.env.example).
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
[ -f "$ROOT/.deploy.env" ] || { echo ".deploy.env yok: deploy/deploy.env.example dosyasını kopyalayıp doldur" >&2; exit 1; }
. "$ROOT/.deploy.env"
exec ssh -p "$CRATEBALL_SSH_PORT" -i "$CRATEBALL_SSH_KEY" -o BatchMode=yes -o ServerAliveInterval=30 "$CRATEBALL_HOST" "$@"
