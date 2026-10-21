/*
 * Gera o token de acesso à sala de vídeo (LiveKit) para uma reunião.
 *
 * Hoje roda como middleware do Vite (desenvolvimento). Quando o backend entrar,
 * este handler passa a validar a sessão da pessoa e se ela foi convidada para a
 * reunião antes de assinar o token — por enquanto ele confia nos parâmetros.
 *
 * Variáveis de ambiente obrigatórias — sem elas o endpoint recusa gerar token.
 * Para o `livekit-server --dev` local, o iniciar-local.ps1 já define:
 *   LIVEKIT_API_KEY=devkey  LIVEKIT_API_SECRET=secret
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { AccessToken } from "livekit-server-sdk";

export async function handleLivekitToken(req: IncomingMessage, res: ServerResponse) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = new URL(req.url ?? "", "http://localhost");
  const room = url.searchParams.get("room") ?? "";
  const identity = url.searchParams.get("identity") ?? "";
  const name = url.searchParams.get("name") ?? identity;
  const host = url.searchParams.get("host") === "1";

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (!apiKey || !apiSecret) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Servidor de vídeo não configurado (LIVEKIT_API_KEY / LIVEKIT_API_SECRET)." }));
    return;
  }
  if (!/^[\w-]{1,64}$/.test(room) || !/^[\w-]{1,64}$/.test(identity)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Parâmetros inválidos." }));
    return;
  }

  const token = new AccessToken(apiKey, apiSecret, { identity, name: name.slice(0, 80), ttl: "6h" });
  token.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true, roomAdmin: host });
  res.end(JSON.stringify({ token: await token.toJwt() }));
}

export function livekitTokenPlugin(): Plugin {
  return {
    name: "huddle-livekit-token",
    configureServer(server) {
      server.middlewares.use("/api/livekit/token", (req, res) => {
        handleLivekitToken(req, res).catch((error) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(error) }));
        });
      });
    },
  };
}
