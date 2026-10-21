/*
 * Regras do HUDDLE no servidor. Cada ação recebe o time inteiro (`ctx.d`, já
 * isolado pelo time da sessão) e a pessoa logada (`ctx.me`), e altera `ctx.d`;
 * quem chama grava as diferenças. Os dados que chegam do navegador nunca são
 * confiáveis: cada campo é conferido e só os campos permitidos são copiados.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { resolveInvited, visibleMeetings, visiblePlays, visibleRecordings } from "../src/lib/selectors.ts";
import { removeRecordingFile } from "./db.ts";
import type { AgendaItem, Audience, BoardElement, Data, Meeting, Member, Play, Recording, Task } from "../src/lib/types";

export class UserError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type Ctx = {
  d: Data;
  me: Member;
  /** Executado depois que a gravação no banco deu certo (ex.: apagar arquivo). */
  after: (() => void)[];
  /** E-mail já usado em qualquer time (o login é global). */
  emailTaken: (email: string) => boolean;
};

const INVITE_DAYS = 7;
export const uid = () => randomUUID();
export const now = () => new Date().toISOString();
export const normEmail = (email: unknown) => text(email, 200).toLowerCase();
export const newInviteToken = () => randomBytes(18).toString("base64url");
const inviteExpiry = () => new Date(Date.now() + INVITE_DAYS * 864e5).toISOString();

// ---------- validação ----------

export function text(value: unknown, max = 200) {
  if (typeof value !== "string") throw new UserError("Dados inválidos.");
  return value.trim().slice(0, max);
}

function strings(value: unknown, max = 100) {
  if (!Array.isArray(value)) throw new UserError("Dados inválidos.");
  return value.slice(0, max).map((v) => text(v, 120));
}

function oneOf<T extends string | number>(value: unknown, options: readonly T[]): T {
  if (!options.includes(value as T)) throw new UserError("Dados inválidos.");
  return value as T;
}

const bool = (value: unknown) => value === true;
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

// ---------- regras de acesso ----------

function requireCommission(ctx: Ctx) {
  if (ctx.me.role !== "commission") throw new UserError("Apenas a comissão técnica pode fazer isso.", 403);
  return ctx.me;
}

function requireMeeting(d: Data, id: unknown) {
  const meeting = d.meetings.find((m) => m.id === id);
  if (!meeting) throw new UserError("Reunião não encontrada.", 404);
  return meeting;
}

/** Comissão vê todas as reuniões do time; atleta só as que foi convidado. */
export function requireVisibleMeeting(ctx: Ctx, id: unknown) {
  const meeting = requireMeeting(ctx.d, id);
  if (ctx.me.role !== "commission" && !meeting.invitedIds.includes(ctx.me.id)) throw new UserError("Reunião não encontrada.", 404);
  return meeting;
}

function requireMember(d: Data, id: unknown) {
  const member = d.members.find((m) => m.id === id);
  if (!member) throw new UserError("Pessoa não encontrada.", 404);
  return member;
}

function requireRecording(d: Data, id: unknown) {
  const rec = d.recordings.find((r) => r.id === id);
  if (!rec) throw new UserError("Gravação não encontrada.", 404);
  return rec;
}

export function notify(d: Data, memberIds: string[], message: string, route: string) {
  for (const memberId of new Set(memberIds)) {
    d.notifications.push({ id: uid(), memberId, text: message, route, createdAt: now() });
  }
}

export function commissionOf(d: Data, teamId: string) {
  return d.members.filter((m) => m.teamId === teamId && m.role === "commission");
}

// ---------- o que cada pessoa recebe ----------

/** Recorte dos dados do time para uma pessoa: sem senhas e só o que ela pode ver. */
export function view(d: Data, me: Member): Data {
  const isCommission = me.role === "commission";
  const meetings = visibleMeetings(d, me);
  const meetingIds = new Set(meetings.map((m) => m.id));
  return {
    teams: d.teams.filter((t) => t.id === me.teamId),
    members: d.members.map(({ passwordHash: _, ...m }) =>
      isCommission || m.id === me.id ? m : { ...m, email: "", inviteToken: "" },
    ),
    meetings,
    rsvps: d.rsvps.filter((r) => meetingIds.has(r.meetingId)),
    acks: d.acks.filter((a) => meetingIds.has(a.meetingId)),
    tasks: isCommission ? d.tasks : d.tasks.filter((t) => t.assigneeId === me.id || meetingIds.has(t.meetingId)),
    notifications: d.notifications.filter((n) => n.memberId === me.id),
    chat: d.chat.filter((c) => meetingIds.has(c.meetingId)),
    recordings: visibleRecordings(d, me),
    plays: visiblePlays(d, me),
  };
}

export function canSeeRecording(d: Data, me: Member, rec: Recording) {
  return visibleRecordings(d, me).some((r) => r.id === rec.id);
}

// ---------- entradas ----------

function audienceInput(value: unknown): Audience {
  const a = (value ?? {}) as Record<string, unknown>;
  return {
    kind: oneOf(a.kind, ["all", "commission", "groups", "members"] as const),
    groups: strings(a.groups ?? []),
    memberIds: strings(a.memberIds ?? [], 500),
  };
}

function agendaInput(value: unknown): AgendaItem[] {
  if (!Array.isArray(value)) throw new UserError("Dados inválidos.");
  return value
    .slice(0, 50)
    .map((item) => ({ id: text(item?.id ?? uid(), 64), title: text(item?.title, 200), minutes: Math.max(0, Math.min(600, num(item?.minutes))) }))
    .filter((item) => item.title);
}

function elementsInput(value: unknown): BoardElement[] {
  if (!Array.isArray(value) || value.length > 2000) throw new UserError("Jogada inválida.");
  return value.map((el) => {
    if (el?.kind === "ball") return { id: text(el.id, 64), kind: "ball", x: num(el.x), y: num(el.y) };
    const base = { id: text(el?.id, 64), color: text(el?.color ?? "", 32) };
    if (el?.kind === "player")
      return { ...base, kind: "player", x: num(el.x), y: num(el.y), side: oneOf(el.side, ["a", "b"] as const), label: text(el.label ?? "", 12) };
    if (el?.kind === "route") {
      if (!Array.isArray(el.points) || el.points.length > 500) throw new UserError("Jogada inválida.");
      return {
        ...base,
        kind: "route",
        points: el.points.map((p: unknown) => [num((p as number[])?.[0]), num((p as number[])?.[1])] as [number, number]),
        style: oneOf(el.style, ["solid", "dashed", "block"] as const),
      };
    }
    if (el?.kind === "text") return { ...base, kind: "text", x: num(el.x), y: num(el.y), text: text(el.text, 300) };
    throw new UserError("Jogada inválida.");
  });
}

const CREST_MAX = 700_000; // escudo em data URL

// ---------- ações da pessoa logada ----------

export const actions: Record<string, (ctx: Ctx, ...args: any[]) => unknown> = {
  // ----- time -----
  updateTeam(ctx, patch: Record<string, unknown>) {
    const me = requireCommission(ctx);
    const team = ctx.d.teams.find((t) => t.id === me.teamId)!;
    if ("name" in patch) team.name = text(patch.name, 80) || team.name;
    if ("sport" in patch) team.sport = text(patch.sport, 80);
    if ("color" in patch) team.color = text(patch.color, 32);
    if ("crest" in patch) {
      const crest = patch.crest == null ? "" : text(patch.crest, CREST_MAX + 1);
      if (crest.length > CREST_MAX) throw new UserError("A imagem do escudo é grande demais.");
      if (crest && !crest.startsWith("data:image/")) throw new UserError("Imagem do escudo inválida.");
      team.crest = crest || undefined;
    }
  },

  addGroup(ctx, name: unknown) {
    const me = requireCommission(ctx);
    const value = text(name, 60);
    if (!value) return;
    const team = ctx.d.teams.find((t) => t.id === me.teamId)!;
    if (!team.groups.some((g) => g.toLowerCase() === value.toLowerCase())) team.groups.push(value);
  },

  removeGroup(ctx, name: unknown) {
    const me = requireCommission(ctx);
    const team = ctx.d.teams.find((t) => t.id === me.teamId)!;
    team.groups = team.groups.filter((g) => g !== name);
    for (const m of ctx.d.members) m.groups = m.groups.filter((g) => g !== name);
  },

  // ----- elenco -----
  inviteMember(ctx, input: Record<string, unknown>) {
    const me = requireCommission(ctx);
    const email = normEmail(input.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserError("Informe um e-mail válido.");
    if (ctx.emailTaken(email)) throw new UserError("Já existe uma pessoa com este e-mail.");
    const role = oneOf(input.role, ["commission", "athlete"] as const);
    const member: Member = {
      id: uid(),
      teamId: me.teamId,
      name: text(input.name, 80),
      email,
      role,
      title: text(input.title, 60) || (role === "athlete" ? "Atleta" : "Comissão técnica"),
      position: text(input.position ?? "", 60),
      number: text(input.number ?? "", 4),
      groups: strings(input.groups ?? []),
      status: "invited",
      inviteToken: newInviteToken(),
      inviteExpiresAt: inviteExpiry(),
      createdAt: now(),
    };
    if (!member.name) throw new UserError("Informe o nome.");
    ctx.d.members.push(member);
    return member;
  },

  /** Também serve para quem esqueceu a senha: o novo link permite criar outra. */
  renewInvite(ctx, memberId: unknown) {
    requireCommission(ctx);
    const member = requireMember(ctx.d, memberId);
    member.inviteToken = newInviteToken();
    member.inviteExpiresAt = inviteExpiry();
    return member;
  },

  updateMember(ctx, memberId: unknown, patch: Record<string, unknown>) {
    requireCommission(ctx);
    const member = requireMember(ctx.d, memberId);
    if ("name" in patch) member.name = text(patch.name, 80) || member.name;
    if ("title" in patch) member.title = text(patch.title, 60);
    if ("position" in patch) member.position = text(patch.position, 60);
    if ("number" in patch) member.number = text(patch.number, 4);
    if ("groups" in patch) member.groups = strings(patch.groups);
    if ("role" in patch) member.role = oneOf(patch.role, ["commission", "athlete"] as const);
  },

  removeMember(ctx, memberId: unknown) {
    const me = requireCommission(ctx);
    if (me.id === memberId) throw new UserError("Você não pode remover a si mesmo.");
    ctx.d.members = ctx.d.members.filter((m) => m.id !== memberId);
  },

  updateProfile(ctx, patch: Record<string, unknown>) {
    ctx.me.name = text(patch?.name, 80) || ctx.me.name;
  },

  // changePassword é tratado no index.ts (precisa do hash assíncrono).

  // ----- reuniões -----
  createMeeting(ctx, input: Record<string, unknown>) {
    const me = requireCommission(ctx);
    const startNow = bool(input.startNow);
    const audience = audienceInput(input.audience);
    const meeting: Meeting = {
      id: uid(),
      teamId: me.teamId,
      title: text(input.title, 140),
      opponent: text(input.opponent ?? "", 80),
      audience,
      invitedIds: resolveInvited(ctx.d, me.teamId, audience, me.id),
      agenda: agendaInput(input.agenda),
      startsAt: startNow ? now() : text(input.startsAt, 40),
      duration: oneOf(input.duration, [30, 45, 60] as const),
      record: bool(input.record),
      callUrl: text(input.callUrl ?? "", 500),
      status: startNow ? "live" : "scheduled",
      createdBy: me.id,
      createdAt: now(),
      startedAt: startNow ? now() : undefined,
      currentItem: 0,
      itemStartedAt: startNow ? now() : undefined,
      joinedIds: startNow ? [me.id] : [],
      notes: "",
    };
    if (!meeting.title) throw new UserError("Informe o título da reunião.");
    if (Number.isNaN(Date.parse(meeting.startsAt))) throw new UserError("Data da reunião inválida.");
    ctx.d.meetings.push(meeting);
    notify(
      ctx.d,
      meeting.invitedIds.filter((id) => id !== me.id),
      startNow ? `Reunião ao vivo agora: ${meeting.title}` : `Você foi convidado: ${meeting.title}`,
      `/reunioes/${meeting.id}`,
    );
    return meeting;
  },

  deleteMeeting(ctx, meetingId: unknown) {
    requireCommission(ctx);
    const meeting = requireMeeting(ctx.d, meetingId);
    ctx.d.meetings = ctx.d.meetings.filter((m) => m.id !== meeting.id);
    ctx.d.rsvps = ctx.d.rsvps.filter((r) => r.meetingId !== meeting.id);
    ctx.d.notifications = ctx.d.notifications.filter((n) => !n.route.includes(meeting.id));
  },

  rsvp(ctx, meetingId: unknown, going: unknown) {
    const meeting = requireVisibleMeeting(ctx, meetingId);
    ctx.d.rsvps = ctx.d.rsvps.filter((r) => !(r.meetingId === meeting.id && r.memberId === ctx.me.id));
    ctx.d.rsvps.push({ meetingId: meeting.id, memberId: ctx.me.id, going: bool(going), at: now() });
  },

  startMeeting(ctx, meetingId: unknown) {
    const me = requireCommission(ctx);
    const meeting = requireMeeting(ctx.d, meetingId);
    meeting.status = "live";
    meeting.startedAt = now();
    meeting.itemStartedAt = now();
    meeting.currentItem = 0;
    if (!meeting.joinedIds.includes(me.id)) meeting.joinedIds.push(me.id);
    notify(ctx.d, meeting.invitedIds.filter((id) => id !== me.id), `Reunião ao vivo agora: ${meeting.title}`, `/reunioes/${meeting.id}/sala`);
  },

  joinMeeting(ctx, meetingId: unknown) {
    const meeting = requireVisibleMeeting(ctx, meetingId);
    if (!meeting.joinedIds.includes(ctx.me.id)) meeting.joinedIds.push(ctx.me.id);
  },

  setAgendaItem(ctx, meetingId: unknown, index: unknown) {
    requireCommission(ctx);
    const meeting = requireMeeting(ctx.d, meetingId);
    meeting.currentItem = Math.max(0, Math.min(Math.round(num(index)), meeting.agenda.length - 1));
    meeting.itemStartedAt = now();
  },

  saveNotes(ctx, meetingId: unknown, notes: unknown) {
    requireCommission(ctx);
    requireMeeting(ctx.d, meetingId).notes = text(notes, 50_000);
  },

  sendChat(ctx, meetingId: unknown, message: unknown) {
    const meeting = requireVisibleMeeting(ctx, meetingId);
    const value = text(message, 2000);
    if (!value) return;
    ctx.d.chat.push({ id: uid(), meetingId: meeting.id, memberId: ctx.me.id, text: value, at: now() });
  },

  endMeeting(ctx, meetingId: unknown) {
    requireCommission(ctx);
    const meeting = requireMeeting(ctx.d, meetingId);
    meeting.status = "ended";
    meeting.endedAt = now();
  },

  publishSummary(ctx, meetingId: unknown, input: Record<string, unknown>) {
    const me = requireCommission(ctx);
    const meeting = requireMeeting(ctx.d, meetingId);
    meeting.status = "published";
    meeting.endedAt ??= now();
    meeting.summary = {
      text: text(input.text ?? "", 50_000),
      decisions: strings(input.decisions ?? [], 100).filter(Boolean),
      attendance: strings(input.attendance ?? [], 500),
      publishedAt: now(),
      publishedBy: me.id,
    };
    const tasks = Array.isArray(input.tasks) ? input.tasks.slice(0, 100) : [];
    for (const raw of tasks) {
      const title = text(raw?.title ?? "", 200);
      const assigneeId = text(raw?.assigneeId ?? "", 64);
      if (!title || !ctx.d.members.some((m) => m.id === assigneeId)) continue;
      const task: Task = {
        id: uid(),
        teamId: me.teamId,
        meetingId: meeting.id,
        title,
        description: text(raw?.description ?? "", 5000),
        assigneeId,
        due: text(raw?.due ?? "", 40),
        status: "pending",
        createdAt: now(),
      };
      ctx.d.tasks.push(task);
      notify(ctx.d, [assigneeId], `Nova tarefa: ${title}`, `/tarefas/${task.id}`);
    }
    notify(ctx.d, meeting.invitedIds.filter((id) => id !== me.id), `Resumo publicado: ${meeting.title}`, `/reunioes/${meeting.id}/resumo`);
  },

  acknowledge(ctx, meetingId: unknown) {
    const meeting = requireVisibleMeeting(ctx, meetingId);
    if (!ctx.d.acks.some((a) => a.meetingId === meeting.id && a.memberId === ctx.me.id))
      ctx.d.acks.push({ meetingId: meeting.id, memberId: ctx.me.id, at: now() });
  },

  remindPending(ctx, meetingId: unknown) {
    requireCommission(ctx);
    const meeting = requireMeeting(ctx.d, meetingId);
    const pending = meeting.invitedIds.filter(
      (id) => id !== meeting.summary?.publishedBy && !ctx.d.acks.some((a) => a.meetingId === meeting.id && a.memberId === id),
    );
    notify(ctx.d, pending, `Lembrete: confirme a leitura do resumo "${meeting.title}"`, `/reunioes/${meeting.id}/resumo`);
    return pending.length;
  },

  // ----- tarefas -----
  completeTask(ctx, taskId: unknown) {
    const task = ctx.d.tasks.find((t) => t.id === taskId);
    if (!task) throw new UserError("Tarefa não encontrada.", 404);
    if (task.assigneeId !== ctx.me.id) throw new UserError("Só o responsável pode concluir a tarefa.", 403);
    task.status = "done";
    task.doneAt = now();
    const meeting = ctx.d.meetings.find((m) => m.id === task.meetingId);
    if (meeting) notify(ctx.d, [meeting.createdBy], `${ctx.me.name} concluiu: ${task.title}`, `/reunioes/${meeting.id}/resumo`);
  },

  // ----- notificações -----
  markRead(ctx, notificationId: unknown) {
    const n = ctx.d.notifications.find((x) => x.id === notificationId && x.memberId === ctx.me.id);
    if (n && !n.readAt) n.readAt = now();
  },

  markAllRead(ctx) {
    for (const n of ctx.d.notifications) if (n.memberId === ctx.me.id && !n.readAt) n.readAt = now();
  },

  // ----- gravações (o envio do arquivo fica no index.ts) -----
  setRecordingVisibility(ctx, id: unknown, visibility: unknown) {
    requireCommission(ctx);
    const rec = requireRecording(ctx.d, id);
    const was = rec.visibility;
    rec.visibility = oneOf(visibility, ["invited", "team"] as const);
    if (was !== "team" && rec.visibility === "team") {
      const meeting = ctx.d.meetings.find((m) => m.id === rec.meetingId);
      const others = ctx.d.members.filter((m) => !meeting?.invitedIds.includes(m.id)).map((m) => m.id);
      notify(ctx.d, others, `Nova gravação liberada: ${meeting?.title ?? "reunião"}`, `/gravacoes/${rec.id}`);
    }
  },

  addRecordingNote(ctx, id: unknown, t: unknown, message: unknown) {
    const me = requireCommission(ctx);
    const rec = requireRecording(ctx.d, id);
    const value = text(message, 2000);
    if (!value) return;
    rec.notes.push({ id: uid(), t: Math.max(0, Math.round(num(t))), text: value, authorId: me.id, at: now() });
    rec.notes.sort((a, b) => a.t - b.t);
  },

  removeRecordingNote(ctx, id: unknown, noteId: unknown) {
    requireCommission(ctx);
    const rec = requireRecording(ctx.d, id);
    rec.notes = rec.notes.filter((n) => n.id !== noteId);
  },

  deleteRecording(ctx, id: unknown) {
    requireCommission(ctx);
    const rec = requireRecording(ctx.d, id);
    ctx.d.recordings = ctx.d.recordings.filter((r) => r.id !== rec.id);
    ctx.after.push(() => removeRecordingFile(rec.id));
  },

  // ----- lousa e playbook -----
  savePlay(ctx, input: Record<string, unknown>, playId?: unknown) {
    const me = requireCommission(ctx);
    const existing = playId ? ctx.d.plays.find((p) => p.id === playId) : undefined;
    const fields = {
      name: text(input.name, 120),
      formation: text(input.formation ?? "", 120),
      groups: strings(input.groups ?? []),
      notes: text(input.notes ?? "", 10_000),
      field: oneOf(input.field, ["gridiron", "soccer", "court", "blank"] as const),
      elements: elementsInput(input.elements),
      published: bool(input.published),
      updatedAt: now(),
    };
    const wasPublished = existing?.published ?? false;
    const play: Play = existing ? Object.assign(existing, fields) : { id: uid(), teamId: me.teamId, createdBy: me.id, ...fields };
    if (!existing) ctx.d.plays.push(play);
    if (play.published && !wasPublished) {
      const targets = ctx.d.members.filter((m) => m.id !== me.id && (!play.groups.length || m.groups.some((g) => play.groups.includes(g))));
      notify(ctx.d, targets.map((m) => m.id), `Nova jogada no playbook: ${play.name}`, `/playbook/${play.id}`);
    }
    return play;
  },

  deletePlay(ctx, id: unknown) {
    requireCommission(ctx);
    ctx.d.plays = ctx.d.plays.filter((p) => p.id !== id);
  },
};
