#!/bin/sh
# Ships the committed code (HEAD) to the VPS and rebuilds it there.
# Waits while a match is running unless --force is given (a restart wipes the in-memory rooms).
set -eu
HOST=${CRATEBALL_HOST:-root@VPS_IP}
SSH="ssh -p ${CRATEBALL_SSH_PORT:-SSH_PORT} -i ${CRATEBALL_SSH_KEY:-$HOME/.ssh/crateball_ed25519} -o BatchMode=yes $HOST"
DIR=/opt/crateball
VERSION=$(git rev-parse --short HEAD)

[ -z "$(git status --porcelain)" ] || echo "Uyarı: commit'lenmemiş değişiklikler yayına girmez (sadece HEAD gider)."

if [ "${1:-}" != "--force" ]; then
  while :; do
    playing=$($SSH "docker compose -f $DIR/deploy/compose.yml exec -T game wget -qO- http://localhost:8080/health 2>/dev/null || echo '{}'" | sed -n 's/.*"playing":\([0-9]*\).*/\1/p')
    [ "${playing:-0}" = "0" ] && break
    echo "$playing maç oynanıyor; bitmesi bekleniyor (zorlamak için --force)…"
    sleep 15
  done
fi

echo "→ $VERSION gönderiliyor"
git archive --format=tar HEAD | $SSH "rm -rf $DIR.new && mkdir -p $DIR.new && tar -x -C $DIR.new && rm -rf $DIR.old && { [ -d $DIR ] && mv $DIR $DIR.old || true; } && mv $DIR.new $DIR"
$SSH "cd $DIR/deploy && APP_VERSION=$VERSION docker compose up -d --build --remove-orphans && docker image prune -f >/dev/null"
sleep 3
$SSH "docker compose -f $DIR/deploy/compose.yml exec -T game wget -qO- http://localhost:8080/health"
echo
echo "✓ yayında: $VERSION"
