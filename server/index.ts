/*
 * API do HUDDLE (roda no ZimaOS, em Docker). Node puro, sem framework.
 *
 *   /api/...  dados, login, convites, gravações e token do vídeo
 *   /rtc...   repassado ao LiveKit — assim o app usa um único endereço público
 *             (Tailscale Funnel na porta 8443) para a API e para o vídeo.
 *
 * Atualizações ao vivo: cada time tem uma versão; quando algo muda, quem está
 * conectado em /api/events recebe a nova versão e busca o estado de novo.
 */
import { createReadStream, createWriteStream, renameSync, rmSync, statSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { AccessToken } from "livekit-server-sdk";
import type { Data, Member, Recording, Team } from "../src/lib/types";
import { actions, canSeeRecording, commissionOf, newInviteToken, normEmail, notify, now, requireVisibleMeeting, text, uid, UserError, view, type Ctx } from "./actions.ts";
import { createSession, hashPassword, readSession, verifyPassword, type Session } from "./auth.ts";
import { findMemberByEmail, findMemberById, findMemberByInvite, listTeams, loadTeam, recordingPath, saveTeam } from "./db.ts";

const PORT = Number(process.env.PORT ?? 3400);
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? "";
const LIVEKIT = new URL(process.env.LIVEKIT_INTERNAL_URL ?? "http://127.0.0.1:7880");
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
const MAX_UPLOAD = Number(process.env.MAX_UPLOAD_MB ?? 4096) * 1024 * 1024;
const MAX_JSON = 2 * 1024 * 1024;
const MIN_PASSWORD = 8;
/** Administradores da plataforma: entram em qualquer time com poderes de comissão. */
const SUPERADMINS = new Set((process.env.SUPERADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));

// ---------- versões e atualizações ao vivo ----------

const versions = new Map<string, number>();
const subscribers = new Map<string, Set<http.ServerResponse>>();
const versionOf = (teamId: string) => versions.get(teamId) ?? 0;

function publish(teamId: string) {
  const v = Math.max(Date.now(), versionOf(teamId) + 1);
  versions.set(teamId, v);
  for (const res of subscribers.get(teamId) ?? []) res.write(`data: ${JSON.stringify({ v })}\n\n`);
}

setInterval(() => {
  for (const set of subscribers.values()) for (const res of set) res.write(": ping\n\n");
}, 25_000).unref();

/** Carrega o time, aplica `fn` num rascunho e grava só o que mudou. */
function mutateTeam<T>(teamId: string, fn: (d: Data) => T): T {
  const before = loadTeam(teamId);
  const draft = structuredClone(before);
  const result = fn(draft);
  saveTeam(teamId, before, draft);
  publish(teamId);
  return result;
}

function activeMember(d: Data, memberId: string) {
  const me = d.members.find((m) => m.id === memberId && m.status === "active");
  if (!me) throw new UserError("Sua sessão expirou. Entre novamente.", 401);
  return me;
}

const isSuperadmin = (member: Member | undefined): member is Member => Boolean(member && member.status === "active" && SUPERADMINS.has(member.email));

/**
 * O administrador da plataforma aparece nos outros times como "Administrador HUDDLE":
 * comissão naquele time, sem entrar no elenco. A permissão é conferida a cada pedido,
 * então tirar o e-mail de SUPERADMIN_EMAILS corta o acesso na hora.
 */
function adminPresence(home: Member, teamId: string): Member {
  const { passwordHash: _, ...rest } = home;
  return { ...rest, teamId, role: "commission", title: "Administrador HUDDLE", position: "", number: "", groups: [] };
}

/** Quem está agindo neste time: um membro dele ou um administrador da plataforma. */
function resolveMe(d: Data, session: Session) {
  const member = d.members.find((m) => m.id === session.memberId && m.status === "active");
  if (member) return member;
  const home = findMemberById(session.memberId);
  if (isSuperadmin(home) && d.teams.length) return adminPresence(home, session.teamId);
  throw new UserError("Sua sessão expirou. Entre novamente.", 401);
}

function sessionFrom(req: http.IncomingMessage, url: URL) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : url.searchParams.get("token");
  const session = readSession(token);
  if (!session) throw new UserError("Sua sessão expirou. Entre novamente.", 401);
  return session;
}

function emailTaken(email: string) {
  return Boolean(findMemberByEmail(email));
}

function stateOf(d: Data, me: Member, teamId: string) {
  const data = view(d, me);
  // Administradores que agiram neste time (ou a própria pessoa, se for um) aparecem com nome nas telas.
  const missing = [me, ...[...SUPERADMINS].map((email) => findMemberByEmail(email))]
    .filter(isSuperadmin)
    .filter((m) => !data.members.some((x) => x.id === m.id) && (m.id === me.id || JSON.stringify(d).includes(m.id)));
  for (const m of missing) data.members.push({ ...adminPresence(m, teamId), email: m.id === me.id ? m.email : "", inviteToken: "" });
  return { v: versionOf(teamId), memberId: me.id, admin: SUPERADMINS.has(me.email), data };
}

/** Nunca devolve hash de senha, mesmo que uma ação retorne a pessoa inteira. */
const clean = (value: unknown) => JSON.parse(JSON.stringify(value ?? null, (key, v) => (key === "passwordHash" ? undefined : v)));

// ---------- tentativas de login ----------

const attempts = new Map<string, { count: number; until: number }>();
function checkAttempts(email: string) {
  const entry = attempts.get(email);
  if (entry && entry.until > Date.now() && entry.count >= 8) throw new UserError("Muitas tentativas. Aguarde alguns minutos e tente de novo.", 429);
}
function failAttempt(email: string) {
  const entry = attempts.get(email);
  if (!entry || entry.until < Date.now()) attempts.set(email, { count: 1, until: Date.now() + 15 * 60_000 });
  else entry.count++;
}

// ---------- HTTP ----------

function originAllowed(origin: string) {
  return ORIGINS.some((pattern) => {
    if (pattern === "*" || pattern === origin) return true;
    if (!pattern.includes("*")) return false;
    const regex = pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[a-z0-9-]*");
    return new RegExp(`^${regex}$`).test(origin);
  });
}

function cors(req: http.IncomingMessage, res: http.ServerResponse) {
  const origin = req.headers.origin;
  if (origin && originAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Max-Age", "600");
  }
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readJson(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_JSON) throw new UserError("Conteúdo grande demais.", 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || "null");
  } catch {
    throw new UserError("Dados inválidos.");
  }
}

// ---------- rotas públicas (sem sessão) ----------

async function register(body: any) {
  const email = normEmail(body?.me?.email);
  const password = text(body?.me?.password, 200);
  const name = text(body?.me?.name, 80);
  if (!name) throw new UserError("Informe seu nome.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserError("Informe um e-mail válido.");
  if (password.length < MIN_PASSWORD) throw new UserError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
  if (emailTaken(email)) throw new UserError("Este e-mail já está cadastrado.");
  const passwordHash = await hashPassword(password);
  const teamId = uid();
  const member = mutateTeam(teamId, (d) => {
    const team: Team = { id: teamId, name: "", sport: "", color: "", groups: [], createdAt: now() };
    const member: Member = {
      id: uid(),
      teamId,
      name,
      email,
      passwordHash,
      role: "commission",
      title: text(body.me.title ?? "", 60) || "Presidente",
      position: "",
      number: "",
      groups: [],
      status: "active",
      inviteToken: newInviteToken(),
      inviteExpiresAt: now(),
      consentAt: now(),
      createdAt: now(),
    };
    d.teams.push(team);
    d.members.push(member);
    // reaproveita a validação de nome, cor e escudo
    actions.updateTeam({ d, me: member, after: [], emailTaken }, body?.team ?? {});
    if (!team.name) throw new UserError("Informe o nome do time.");
    return member;
  });
  return { token: createSession({ memberId: member.id, teamId }), state: stateOf(loadTeam(teamId), member, teamId) };
}

async function login(body: any) {
  const email = normEmail(body?.email);
  checkAttempts(email);
  const found = findMemberByEmail(email);
  const ok = found?.status === "active" && (await verifyPassword(text(body?.password, 200), found.passwordHash));
  if (!found || !ok) {
    failAttempt(email);
    throw new UserError("E-mail ou senha incorretos.", 401);
  }
  attempts.delete(email);
  const d = loadTeam(found.teamId);
  return { token: createSession({ memberId: found.id, teamId: found.teamId }), state: stateOf(d, found, found.teamId) };
}

function inviteInfo(token: string) {
  const member = findMemberByInvite(token);
  if (!member) throw new UserError("Convite não encontrado.", 404);
  const d = loadTeam(member.teamId);
  const team = d.teams[0];
  const invitedBy = commissionOf(d, member.teamId)[0];
  const expired = new Date(member.inviteExpiresAt).getTime() < Date.now();
  return {
    member: { name: member.name, email: member.email, title: member.title, position: member.position, number: member.number, status: member.status },
    team: team && { id: team.id, name: team.name, sport: team.sport, color: team.color, crest: team.crest, groups: [], createdAt: team.createdAt },
    invitedBy: invitedBy && { name: invitedBy.name },
    used: member.status === "active" && expired,
    expired,
  };
}

/** Ativa o convite — ou cria uma nova senha, quando a comissão renovou o link de quem já tinha conta. */
async function activateInvite(token: string, body: any) {
  const password = text(body?.password, 200);
  if (password.length < MIN_PASSWORD) throw new UserError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
  const found = findMemberByInvite(token);
  if (!found) throw new UserError("Convite não encontrado.", 404);
  const passwordHash = await hashPassword(password);
  const member = mutateTeam(found.teamId, (d) => {
    const member = d.members.find((m) => m.id === found.id && m.inviteToken === token);
    if (!member) throw new UserError("Convite não encontrado.", 404);
    if (new Date(member.inviteExpiresAt).getTime() < Date.now())
      throw new UserError(member.status === "active" ? "Este link já foi usado. Entre com seu e-mail e senha." : "Este convite expirou.");
    const firstAccess = member.status === "invited";
    member.name = text(body?.name ?? "", 80) || member.name;
    member.passwordHash = passwordHash;
    member.status = "active";
    member.consentAt ??= now();
    member.inviteExpiresAt = now(); // o link vale uma vez só
    if (firstAccess) {
      const others = commissionOf(d, member.teamId).filter((m) => m.id !== member.id);
      notify(d, others.map((m) => m.id), `${member.name} ativou o acesso.`, `/elenco`);
    }
    return member;
  });
  return { token: createSession({ memberId: member.id, teamId: member.teamId }), state: stateOf(loadTeam(member.teamId), member, member.teamId) };
}

function requestNewInvite(token: string) {
  const found = findMemberByInvite(token);
  if (!found) return;
  mutateTeam(found.teamId, (d) => {
    notify(d, commissionOf(d, found.teamId).map((m) => m.id), `${found.name} pediu um novo convite.`, `/elenco/${found.id}`);
  });
}

/** Sem e-mail por enquanto: a comissão é avisada e gera um link de nova senha. */
function requestPasswordReset(body: any) {
  const found = findMemberByEmail(normEmail(body?.email));
  if (!found || found.status !== "active") return;
  mutateTeam(found.teamId, (d) => {
    const commission = commissionOf(d, found.teamId).filter((m) => m.id !== found.id);
    notify(d, commission.map((m) => m.id), `${found.name} pediu para redefinir a senha.`, `/elenco/${found.id}`);
  });
}

// ---------- rotas com sessão ----------

function runAction(req: http.IncomingMessage, url: URL, name: string, args: unknown) {
  if (!Object.prototype.hasOwnProperty.call(actions, name)) throw new UserError("Ação desconhecida.", 404);
  if (!Array.isArray(args)) throw new UserError("Dados inválidos.");
  const session = sessionFrom(req, url);
  const after: (() => void)[] = [];
  const out = mutateTeam(session.teamId, (d) => {
    const me = resolveMe(d, session);
    const result = actions[name]({ d, me, after, emailTaken }, ...args);
    return { result, d, me };
  });
  for (const fn of after) fn();
  return { result: clean(out.result), state: stateOf(out.d, out.me, session.teamId) };
}

async function changePassword(req: http.IncomingMessage, url: URL, body: any) {
  const session = sessionFrom(req, url);
  // a senha mora no time de origem (para o administrador, pode ser outro time)
  const home = findMemberById(session.memberId);
  if (!home) throw new UserError("Sua sessão expirou. Entre novamente.", 401);
  const me = activeMember(loadTeam(home.teamId), home.id);
  if (!(await verifyPassword(text(body?.current, 200), me.passwordHash))) throw new UserError("A senha atual está incorreta.");
  const next = text(body?.next, 200);
  if (next.length < MIN_PASSWORD) throw new UserError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
  const passwordHash = await hashPassword(next);
  mutateTeam(home.teamId, (d) => {
    activeMember(d, home.id).passwordHash = passwordHash;
  });
}

async function uploadRecording(req: http.IncomingMessage, url: URL) {
  const session = sessionFrom(req, url);
  const meetingId = url.searchParams.get("meetingId") ?? "";
  const mimeType = (url.searchParams.get("mimeType") ?? "").slice(0, 120);
  if (!/^(video|audio)\/[\w.+-]+/.test(mimeType)) throw new UserError("Formato de vídeo inválido.");
  let chapters: Recording["chapters"] = [];
  try {
    const raw = JSON.parse(url.searchParams.get("chapters") ?? "[]");
    if (Array.isArray(raw)) chapters = raw.slice(0, 200).map((c) => ({ t: Math.max(0, Number(c?.t) || 0), title: String(c?.title ?? "").slice(0, 200) }));
  } catch {
    // capítulos são opcionais
  }

  // confere a permissão antes de receber o arquivo
  const before = loadTeam(session.teamId);
  const me = resolveMe(before, session);
  if (me.role !== "commission") throw new UserError("Apenas a comissão técnica pode gravar.", 403);
  if (!before.meetings.some((m) => m.id === meetingId)) throw new UserError("Reunião não encontrada.", 404);

  const id = uid();
  const tmp = `${recordingPath(id)}.part`;
  let size = 0;
  const limit = new Transform({
    transform(chunk, _enc, done) {
      size += chunk.length;
      done(size > MAX_UPLOAD ? new UserError("A gravação é grande demais.", 413) : null, chunk);
    },
  });
  try {
    await pipeline(req, limit, createWriteStream(tmp));
    if (!size) throw new UserError("Arquivo vazio.");
    renameSync(tmp, recordingPath(id));
  } catch (error) {
    rmSync(tmp, { force: true });
    throw error;
  }

  const out = mutateTeam(session.teamId, (d) => {
    const me = resolveMe(d, session);
    const recording: Recording = {
      id,
      teamId: me.teamId,
      meetingId,
      createdBy: me.id,
      createdAt: now(),
      durationSec: Math.round(Number(url.searchParams.get("durationSec")) || 0),
      size,
      mimeType,
      chapters,
      notes: [],
      visibility: "invited",
    };
    d.recordings.push(recording);
    return { recording, d, me };
  });
  return { result: out.recording, state: stateOf(out.d, out.me, session.teamId) };
}

/** Serve o vídeo com suporte a Range (para o player poder pular no tempo). */
function serveRecording(req: http.IncomingMessage, res: http.ServerResponse, url: URL, id: string) {
  const session = sessionFrom(req, url);
  const d = loadTeam(session.teamId);
  const me = resolveMe(d, session);
  const rec = d.recordings.find((r) => r.id === id);
  if (!rec || !canSeeRecording(d, me, rec)) throw new UserError("Gravação não encontrada.", 404);
  const file = recordingPath(rec.id);
  let total: number;
  try {
    total = statSync(file).size;
  } catch {
    throw new UserError("O arquivo desta gravação não está no servidor.", 404);
  }
  const headers = { "Content-Type": rec.mimeType, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (!range) {
    res.writeHead(200, { ...headers, "Content-Length": total });
    createReadStream(file).pipe(res);
    return;
  }
  let start = range[1] ? Number(range[1]) : total - Number(range[2]);
  let end = range[1] && range[2] ? Number(range[2]) : total - 1;
  start = Math.max(0, start);
  end = Math.min(end, total - 1);
  if (start > end) {
    res.writeHead(416, { "Content-Range": `bytes */${total}` });
    res.end();
    return;
  }
  res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${total}`, "Content-Length": end - start + 1 });
  createReadStream(file, { start, end }).pipe(res);
}

/** Token da sala: só para quem pode ver a reunião; comissão administra a sala. */
async function livekitToken(req: http.IncomingMessage, url: URL) {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) throw new UserError("Servidor de vídeo não configurado (LIVEKIT_API_KEY / LIVEKIT_API_SECRET).", 500);
  const session = sessionFrom(req, url);
  const d = loadTeam(session.teamId);
  const me = resolveMe(d, session);
  const ctx: Ctx = { d, me, after: [], emailTaken };
  const meeting = requireVisibleMeeting(ctx, url.searchParams.get("meetingId"));
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: me.id, name: me.name, ttl: "6h" });
  token.addGrant({ room: meeting.id, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true, roomAdmin: me.role === "commission" });
  return { token: await token.toJwt() };
}

function requireSuperadmin(req: http.IncomingMessage, url: URL) {
  const home = findMemberById(sessionFrom(req, url).memberId);
  if (!isSuperadmin(home)) throw new UserError("Acesso restrito à administração da plataforma.", 403);
  return home;
}

/** Nova sessão do administrador dentro do time escolhido. */
function enterTeam(home: Member, body: any) {
  const teamId = text(body?.teamId, 64);
  const d = loadTeam(teamId);
  if (!d.teams.length) throw new UserError("Time não encontrado.", 404);
  const session = { memberId: home.id, teamId };
  return { token: createSession(session), state: stateOf(d, resolveMe(d, session), teamId) };
}

function subscribe(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  const session = sessionFrom(req, url);
  resolveMe(loadTeam(session.teamId), session);
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.write(`retry: 3000\ndata: ${JSON.stringify({ v: versionOf(session.teamId) })}\n\n`);
  const set = subscribers.get(session.teamId) ?? new Set();
  subscribers.set(session.teamId, set);
  set.add(res);
  req.on("close", () => set.delete(res));
}

// ---------- LiveKit (/rtc) ----------

function proxyToLivekit(req: http.IncomingMessage, res: http.ServerResponse) {
  const upstream = http.request(
    { hostname: LIVEKIT.hostname, port: LIVEKIT.port || 80, method: req.method, path: req.url, headers: req.headers },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) send(res, 502, { error: "Servidor de vídeo indisponível." });
    else res.destroy();
  });
  req.pipe(upstream);
}

// ---------- servidor ----------

async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url ?? "/", "http://huddle");
  const p = url.pathname;
  const m = req.method;

  if (p.startsWith("/rtc")) return proxyToLivekit(req, res);
  cors(req, res);
  if (m === "OPTIONS") return res.writeHead(204).end();

  if (m === "GET" && p === "/api/health") return send(res, 200, { ok: true });
  if (m === "POST" && p === "/api/auth/register") return send(res, 200, await register(await readJson(req)));
  if (m === "POST" && p === "/api/auth/login") return send(res, 200, await login(await readJson(req)));
  if (m === "POST" && p === "/api/auth/recover") {
    requestPasswordReset(await readJson(req));
    return send(res, 200, { ok: true });
  }

  const invite = /^\/api\/invites\/([\w-]{8,64})(\/activate|\/request-new)?$/.exec(p);
  if (invite) {
    const [, token, sub] = invite;
    if (m === "GET" && !sub) return send(res, 200, inviteInfo(token));
    if (m === "POST" && sub === "/activate") return send(res, 200, await activateInvite(token, await readJson(req)));
    if (m === "POST" && sub === "/request-new") {
      requestNewInvite(token);
      return send(res, 200, { ok: true });
    }
  }

  if (m === "GET" && p === "/api/state") {
    const session = sessionFrom(req, url);
    const d = loadTeam(session.teamId);
    return send(res, 200, stateOf(d, resolveMe(d, session), session.teamId));
  }
  if (m === "GET" && p === "/api/events") return subscribe(req, res, url);
  if (p === "/api/admin/teams" && m === "GET") {
    requireSuperadmin(req, url);
    return send(res, 200, { teams: listTeams() });
  }
  if (p === "/api/admin/enter" && m === "POST") return send(res, 200, enterTeam(requireSuperadmin(req, url), await readJson(req)));
  if (m === "POST" && p === "/api/me/password") {
    await changePassword(req, url, await readJson(req));
    return send(res, 200, { ok: true });
  }
  const action = /^\/api\/actions\/(\w+)$/.exec(p);
  if (m === "POST" && action) return send(res, 200, runAction(req, url, action[1], await readJson(req)));
  if (m === "POST" && p === "/api/recordings") return send(res, 200, await uploadRecording(req, url));
  const file = /^\/api\/recordings\/([\w-]+)\/file$/.exec(p);
  if (m === "GET" && file) return serveRecording(req, res, url, file[1]);
  if (m === "GET" && p === "/api/livekit/token") return send(res, 200, await livekitToken(req, url));

  send(res, 404, { error: "Não encontrado." });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    if (error instanceof UserError) return res.headersSent ? res.destroy() : send(res, error.status, { error: error.message });
    console.error(error);
    if (res.headersSent) res.destroy();
    else send(res, 500, { error: "Erro no servidor. Tente de novo." });
  });
});

// Envio de gravações longas não pode cair por tempo limite.
server.requestTimeout = 0;

// WebSocket do LiveKit: repassa a conexão inteira para o servidor de vídeo.
server.on("upgrade", (req, socket, head) => {
  if (!req.url?.startsWith("/rtc")) return socket.destroy();
  const upstream = net.connect(Number(LIVEKIT.port || 80), LIVEKIT.hostname, () => {
    let raw = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) raw += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
    upstream.write(`${raw}\r\n`);
    if (head.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(PORT, () => {
  console.log(`HUDDLE API na porta ${PORT} · LiveKit em ${LIVEKIT.origin} · origens: ${ORIGINS.join(", ") || "(nenhuma)"}`);
});
