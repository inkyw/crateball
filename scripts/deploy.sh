#!/bin/sh
# Ships the committed code (HEAD) to the VPS; the server-side script (deploy/remote-deploy.sh,
# installed as crateball-deploy) rebuilds it and waits while a match is running unless --force.
# The same server script is what the GitHub release workflow calls.
set -eu
SSH="sh $(dirname "$0")/server.sh"
VERSION=$(git rev-parse --short HEAD)
FORCE=""
[ "${1:-}" = "--force" ] && FORCE=force

[ -z "$(git status --porcelain)" ] || echo "Uyarı: commit'lenmemiş değişiklikler yayına girmez (sadece HEAD gider)."
echo "→ $VERSION gönderiliyor"
git archive --format=tar HEAD | $SSH "crateball-deploy deploy $VERSION $FORCE"
echo "✓ yayında: $VERSION"
