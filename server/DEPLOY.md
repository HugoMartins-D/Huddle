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

## Limites conhecidos

- Todo o áudio e vídeo passa pelo TURN via Funnel (TCP). Funciona sem mexer no roteador,
  mas reuniões com muitas câmeras abertas podem perder qualidade. Se isso acontecer, o
  caminho é abrir portas UDP no roteador (precisa de IP público) ou usar o LiveKit Cloud.
- Sem envio de e-mail: convites e links de nova senha são copiados pela comissão.
