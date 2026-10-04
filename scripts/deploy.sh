#!/bin/sh
# Ships the committed code (HEAD) to the VPS; the server-side script (deploy/remote-deploy.sh,
# installed as crateball-deploy) rebuilds it and waits while a match is running unless --force.
# The same server script is what the GitHub release workflow calls.
set -eu
HOST=${CRATEBALL_HOST:-root@VPS_IP}
SSH="ssh -p ${CRATEBALL_SSH_PORT:-SSH_PORT} -i ${CRATEBALL_SSH_KEY:-$HOME/.ssh/crateball_ed25519} -o BatchMode=yes $HOST"
VERSION=$(git rev-parse --short HEAD)
FORCE=""
[ "${1:-}" = "--force" ] && FORCE=force

[ -z "$(git status --porcelain)" ] || echo "Uyarı: commit'lenmemiş değişiklikler yayına girmez (sadece HEAD gider)."
echo "→ $VERSION gönderiliyor"
git archive --format=tar HEAD | $SSH "crateball-deploy deploy $VERSION $FORCE"
echo "✓ yayında: $VERSION"
