#!/bin/sh
# Vigia do HUDDLE, fora do Docker: se a API não responder, sobe os containers de novo.
# Já aconteceu de o ZimaOS reiniciar e o Docker não religar nada, nem com restart: always.
#
# Instalar no ZimaOS (uma vez):  sudo crontab -e   e acrescentar as duas linhas:
#   */2 * * * * sh "/DATA/CODE LESS/PROJETOS/HUDDLE/server/scripts/watchdog.sh"
#   @reboot sleep 90 && sh "/DATA/CODE LESS/PROJETOS/HUDDLE/server/scripts/watchdog.sh"
# Log: server/data/watchdog.log
DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$DIR/data/watchdog.log"
mkdir -p "$DIR/data"

healthy() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -m 5 http://127.0.0.1:3400/api/health >/dev/null 2>&1
  else
    wget -q -T 5 -O /dev/null http://127.0.0.1:3400/api/health >/dev/null 2>&1
  fi
}

healthy && exit 0

# uma rodada por vez (o cron pode disparar outra enquanto esta ainda espera)
LOCK=/tmp/huddle-watchdog.lock
mkdir "$LOCK" 2>/dev/null || exit 0
trap 'rmdir "$LOCK"' EXIT

sleep 20 # pode ser só a API reiniciando: confere de novo antes de agir
healthy && exit 0

echo "$(date -Iseconds) API sem resposta: subindo os containers" >> "$LOG"
docker compose --project-directory "$DIR" -f "$DIR/docker-compose.yml" up -d >> "$LOG" 2>&1
sleep 30
if healthy; then echo "$(date -Iseconds) API de volta" >> "$LOG"; else echo "$(date -Iseconds) API continua fora — ver: docker compose logs api" >> "$LOG"; fi

# mantém só as últimas 500 linhas
tail -n 500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
