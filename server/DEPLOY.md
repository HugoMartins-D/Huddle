# Publicar o HUDDLE (Vercel + ZimaOS)

```
navegador ──► Vercel (app)                    huddle-hugo-project.vercel.app
    │
    ├─► https://servidor.tail39f8dc.ts.net:8443   API (dados, login, gravações)
    │                                              e /rtc → LiveKit (sinalização do vídeo)
    └─► turns://servidor.tail39f8dc.ts.net:10000   TURN do LiveKit (áudio e vídeo)
                     │
             Tailscale Funnel (no ZimaOS)
                     │
     Docker: huddle-api-1 (127.0.0.1:3400) · huddle-livekit-1 (127.0.0.1:5349)
```

A porta 443 continua com o Lead Generator; o HUDDLE usa só a 8443 e a 10000.
Nenhuma porta do roteador precisa ser aberta.

## 1. ZimaOS (uma vez)

No terminal do ZimaOS (painel → Terminal, ou `ssh Hugo@SERVIDOR.local`):

```sh
cd "/DATA/CODE LESS/PROJETOS/HUDDLE/server"
cp .env.example .env
# gere os segredos e cole no .env (SESSION_SECRET e LIVEKIT_API_SECRET):
openssl rand -hex 32
openssl rand -hex 32
nano .env

sudo docker compose up -d --build
curl -s http://127.0.0.1:3400/api/health      # → {"ok":true}
```

O banco (`huddle.db`) e as gravações ficam em `server/data/` (fora do git).

## 2. Tailscale Funnel (uma vez)

```sh
sudo docker exec tailscale tailscale funnel status                     # confira se 8443 e 10000 estão livres
sudo docker exec tailscale tailscale funnel --bg --https=8443 http://127.0.0.1:3400
sudo docker exec tailscale tailscale funnel --bg --tls-terminated-tcp=10000 tcp://127.0.0.1:5349
sudo docker exec tailscale tailscale funnel status
```

Teste de fora de casa (ex.: 4G do celular): `https://servidor.tail39f8dc.ts.net:8443/api/health`.

## 3. Vercel (uma vez)

Projeto **huddle** → Settings → Environment Variables (Production e Preview):

| Nome | Valor |
| --- | --- |
| `VITE_API_URL` | `https://servidor.tail39f8dc.ts.net:8443` |
| `VITE_LIVEKIT_URL` | `wss://servidor.tail39f8dc.ts.net:8443` |

Depois, **Redeploy**. As variáveis `VITE_` entram no build; mudar o valor exige novo deploy.

Projeto → Settings → Deployment Protection: deixe **Vercel Authentication desligado**
(ou só para Preview). Com ele ligado, atletas caem numa tela de login da Vercel.

## Atualizar

- **App:** `git push` (a Vercel publica sozinha).
- **API:** no ZimaOS, `cd ".../HUDDLE/server" && sudo docker compose up -d --build`.

## Operação

| O quê | Comando |
| --- | --- |
| Logs | `sudo docker compose logs -f api` (ou `livekit`) |
| Reiniciar | `sudo docker compose restart` |
| Backup | copiar `server/data/` (com a API parada: `sudo docker compose stop api`) |
| Funnel caiu | repetir os dois comandos do passo 2 |

## Se o servidor cair

Já aconteceu de o ZimaOS reiniciar e o Docker não religar os containers. Três proteções:

1. `restart: always` e healthcheck da API no `docker-compose.yml`.
2. **Vigia no cron do ZimaOS** (fora do Docker) — instalar uma vez com `sudo crontab -e`:
   ```
   */2 * * * * sh "/DATA/CODE LESS/PROJETOS/HUDDLE/server/scripts/watchdog.sh"
   @reboot sleep 90 && sh "/DATA/CODE LESS/PROJETOS/HUDDLE/server/scripts/watchdog.sh"
   ```
   Se a API não responder, ele roda `docker compose up -d`. Log: `server/data/watchdog.log`.
3. **Monitor no GitHub** (`.github/workflows/monitor.yml`): testa o endereço público a cada 15 min e
   manda e-mail se falhar. O GitHub desliga agendamentos de repositórios sem commits há 60 dias —
   nesse caso, reative em Actions → Monitor do servidor.

Diagnóstico rápido: `https://servidor.tail39f8dc.ts.net:8443/api/health` com **502** = Tailscale ok,
container parado → `sudo docker compose up -d` aqui na pasta `server/`.

## Administração da plataforma

`SUPERADMIN_EMAILS` (no `server/.env`) lista quem pode entrar em qualquer time.

- **Ordem para criar um administrador:** primeiro a pessoa cria a conta normalmente pelo site
  (Registrar time); depois o e-mail entra em `SUPERADMIN_EMAILS` e a API é reiniciada
  (`sudo docker compose up -d --force-recreate api`). E-mails da lista ficam reservados: ninguém
  consegue cadastrá-los nem convidá-los.
- A conta do administrador não pode ser editada, removida nem receber link de nova senha pela
  comissão do time onde está cadastrada. Para trocar a senha, use **Meu perfil**; se esquecer,
  tire o e-mail da lista, gere o link pelo time e coloque o e-mail de volta.
- Trocar ou redefinir a senha derruba as outras sessões abertas daquela conta.

## Vídeo: dois detalhes do TURN

- **Porta do TURN:** com `external_tls`, o LiveKit sempre anuncia o TURN como `turns:<domínio>:443`. Como a 443
  é do Lead Generator, o app troca para a 10000 antes de conectar (`VITE_TURN_TLS_PORT`, padrão `10000`
  em produção; veja `src/components/VideoStage.tsx`).
- **Repasse para IP privado:** o TURN do LiveKit recusa repassar mídia para IPs privados, inclusive o do próprio
  LiveKit. Por isso o contêiner tem IP fixo (`172.31.250.10`) e só esse IP está em `allow_restricted_peer_cidrs`.
  Mudar a rede exige `sudo docker compose down` antes do `up`.

## Limites conhecidos

- Todo o áudio e vídeo passa pelo TURN via Funnel (TCP). Funciona sem mexer no roteador,
  mas reuniões com muitas câmeras abertas podem perder qualidade. Se isso acontecer, o
  caminho é abrir portas UDP no roteador (precisa de IP público) ou usar o LiveKit Cloud.
- Sem envio de e-mail: convites e links de nova senha são copiados pela comissão.
