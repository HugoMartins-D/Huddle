/*
 * Camada de dados do frontend. Hoje grava no localStorage do navegador; quando o
 * banco entrar, só este arquivo muda — as telas falam apenas com `api` e `useStore`.
 *
 * A sessão fica no sessionStorage: cada aba pode estar logada com uma pessoa
 * diferente (útil para testar comissão e atleta lado a lado). As abas se
 * sincronizam pelo evento `storage`.
 */
import { useSyncExternalStore } from "react";
import { blobs } from "./blobs";
import type { AgendaItem, Audience, Chapter, Data, Meeting, Member, Play, Recording, Role, Team } from "./types";

const DATA_KEY = "huddle:dados:v1";
const SESSION_KEY = "huddle:sessao";
const INVITE_DAYS = 7;

const empty = (): Data => ({
  teams: [],
  members: [],
  meetings: [],
  rsvps: [],
  acks: [],
  tasks: [],
  notifications: [],
  chat: [],
  recordings: [],
  plays: [],
});

function load(): Data {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

function loadSession(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

let data = load();
let sessionId = loadSession();
let snapshot = { data, sessionId };
const listeners = new Set<() => void>();

function emit() {
  snapshot = { data, sessionId };
  listeners.forEach((listener) => listener());
}

function mutate<T>(fn: (draft: Data) => T): T {
  const draft = structuredClone(data);
  const result = fn(draft);
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(draft));
  } catch {
    throw new Error("Não foi possível salvar neste navegador (armazenamento cheio ou bloqueado).");
  }
  data = draft;
  emit();
  return result;
}

function setSession(id: string | null) {
  sessionId = id;
  try {
    if (id) sessionStorage.setItem(SESSION_KEY, id);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // sem sessionStorage a sessão vale só enquanto a página estiver aberta
  }
  emit();
}

window.addEventListener("storage", (event) => {
  if (event.key === DATA_KEY) {
    data = load();
    emit();
  }
});

export function useStore() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
  );
}

export function useSession() {
  const { data, sessionId } = useStore();
  const me = data.members.find((m) => m.id === sessionId && m.status === "active");
  const team = me ? data.teams.find((t) => t.id === me.teamId) : undefined;
  return { data, me, team };
}

// ---------- utilitários ----------

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const normEmail = (email: string) => email.trim().toLowerCase();
const inviteExpiry = () => new Date(Date.now() + INVITE_DAYS * 864e5).toISOString();
const token = () => crypto.randomUUID().replace(/-/g, "");

async function hash(password: string) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function requireMe(d: Data) {
  const me = d.members.find((m) => m.id === sessionId && m.status === "active");
  if (!me) throw new Error("Sua sessão expirou. Entre novamente.");
  return me;
}

function requireCommission(d: Data) {
  const me = requireMe(d);
  if (me.role !== "commission") throw new Error("Apenas a comissão técnica pode fazer isso.");
  return me;
}

function requireMeeting(d: Data, id: string) {
  const meeting = d.meetings.find((m) => m.id === id);
  if (!meeting) throw new Error("Reunião não encontrada.");
  return meeting;
}

function notify(d: Data, memberIds: string[], text: string, route: string) {
  for (const memberId of new Set(memberIds)) {
    d.notifications.push({ id: uid(), memberId, text, route, createdAt: now() });
  }
}

export function resolveInvited(d: Data, teamId: string, audience: Audience, creatorId: string) {
  const members = d.members.filter((m) => m.teamId === teamId);
  let ids: string[];
  if (audience.kind === "all") ids = members.map((m) => m.id);
  else if (audience.kind === "commission") ids = members.filter((m) => m.role === "commission").map((m) => m.id);
  else if (audience.kind === "groups")
    ids = members.filter((m) => m.groups.some((g) => audience.groups.includes(g))).map((m) => m.id);
  else ids = audience.memberIds.filter((id) => members.some((m) => m.id === id));
  return Array.from(new Set([creatorId, ...ids]));
}

export function inviteLink(member: Member) {
  return `${location.origin}${location.pathname}#/convite/${member.inviteToken}`;
}

// ---------- API ----------

export type NewMemberInput = {
  name: string;
  email: string;
  role: Role;
  title: string;
  position: string;
  number: string;
  groups: string[];
};

export type NewMeetingInput = {
  title: string;
  opponent: string;
  audience: Audience;
  agenda: AgendaItem[];
  startsAt: string;
  duration: 30 | 45 | 60;
  record: boolean;
  callUrl: string;
  startNow: boolean;
};

export type TaskInput = { title: string; description: string; assigneeId: string; due: string };

export type PlayInput = Pick<Play, "name" | "formation" | "groups" | "notes" | "field" | "elements" | "published">;

export const api = {
  // ----- acesso -----
  async registerTeam(input: {
    team: Pick<Team, "name" | "sport" | "color" | "crest">;
    me: { name: string; email: string; password: string; title: string };
  }) {
    const email = normEmail(input.me.email);
    const passwordHash = await hash(input.me.password);
    const memberId = mutate((d) => {
      if (d.members.some((m) => m.email === email)) throw new Error("Este e-mail já está cadastrado.");
      const team: Team = { id: uid(), ...input.team, groups: [], createdAt: now() };
      const member: Member = {
        id: uid(),
        teamId: team.id,
        name: input.me.name.trim(),
        email,
        passwordHash,
        role: "commission",
        title: input.me.title.trim() || "Presidente",
        position: "",
        number: "",
        groups: [],
        status: "active",
        inviteToken: token(),
        inviteExpiresAt: now(),
        consentAt: now(),
        createdAt: now(),
      };
      d.teams.push(team);
      d.members.push(member);
      return member.id;
    });
    setSession(memberId);
  },

  async login(email: string, password: string) {
    const passwordHash = await hash(password);
    const member = data.members.find(
      (m) => m.email === normEmail(email) && m.status === "active" && m.passwordHash === passwordHash,
    );
    if (!member) throw new Error("E-mail ou senha incorretos.");
    setSession(member.id);
  },

  logout() {
    setSession(null);
  },

  findInvite(inviteToken: string) {
    const member = data.members.find((m) => m.inviteToken === inviteToken);
    if (!member) return null;
    const team = data.teams.find((t) => t.id === member.teamId);
    const invitedBy = data.members.find((m) => m.teamId === member.teamId && m.role === "commission");
    return {
      member,
      team,
      invitedBy,
      used: member.status === "active",
      expired: new Date(member.inviteExpiresAt).getTime() < Date.now(),
    };
  },

  async activateInvite(inviteToken: string, input: { name: string; password: string }) {
    const passwordHash = await hash(input.password);
    const memberId = mutate((d) => {
      const member = d.members.find((m) => m.inviteToken === inviteToken);
      if (!member) throw new Error("Convite não encontrado.");
      if (member.status === "active") throw new Error("Este convite já foi usado. Entre com seu e-mail e senha.");
      if (new Date(member.inviteExpiresAt).getTime() < Date.now()) throw new Error("Este convite expirou.");
      member.name = input.name.trim() || member.name;
      member.passwordHash = passwordHash;
      member.status = "active";
      member.consentAt = now();
      const commission = d.members.filter((m) => m.teamId === member.teamId && m.role === "commission" && m.id !== member.id);
      notify(d, commission.map((m) => m.id), `${member.name} ativou o acesso.`, `/elenco`);
      return member.id;
    });
    setSession(memberId);
  },

  async requestNewInvite(inviteToken: string) {
    mutate((d) => {
      const member = d.members.find((m) => m.inviteToken === inviteToken);
      if (!member) return;
      const commission = d.members.filter((m) => m.teamId === member.teamId && m.role === "commission");
      notify(d, commission.map((m) => m.id), `${member.name} pediu um novo convite.`, `/elenco/${member.id}`);
    });
  },

  async requestPasswordReset(_email: string) {
    // O envio de e-mail entra junto com o backend.
  },

  // ----- time -----
  async updateTeam(patch: Partial<Pick<Team, "name" | "sport" | "color" | "crest">>) {
    mutate((d) => {
      const me = requireCommission(d);
      const team = d.teams.find((t) => t.id === me.teamId)!;
      Object.assign(team, patch);
    });
  },

  async addGroup(name: string) {
    const value = name.trim();
    if (!value) return;
    mutate((d) => {
      const me = requireCommission(d);
      const team = d.teams.find((t) => t.id === me.teamId)!;
      if (!team.groups.some((g) => g.toLowerCase() === value.toLowerCase())) team.groups.push(value);
    });
  },

  async removeGroup(name: string) {
    mutate((d) => {
      const me = requireCommission(d);
      const team = d.teams.find((t) => t.id === me.teamId)!;
      team.groups = team.groups.filter((g) => g !== name);
      for (const m of d.members) if (m.teamId === team.id) m.groups = m.groups.filter((g) => g !== name);
    });
  },

  // ----- elenco -----
  async inviteMember(input: NewMemberInput) {
    return mutate((d) => {
      const me = requireCommission(d);
      const email = normEmail(input.email);
      if (d.members.some((m) => m.email === email)) throw new Error("Já existe uma pessoa com este e-mail.");
      const member: Member = {
        id: uid(),
        teamId: me.teamId,
        name: input.name.trim(),
        email,
        role: input.role,
        title: input.title.trim() || (input.role === "athlete" ? "Atleta" : "Comissão técnica"),
        position: input.position.trim(),
        number: input.number.trim(),
        groups: input.groups,
        status: "invited",
        inviteToken: token(),
        inviteExpiresAt: inviteExpiry(),
        createdAt: now(),
      };
      d.members.push(member);
      return member;
    });
  },

  async renewInvite(memberId: string) {
    mutate((d) => {
      requireCommission(d);
      const member = d.members.find((m) => m.id === memberId)!;
      member.inviteToken = token();
      member.inviteExpiresAt = inviteExpiry();
    });
  },

  async updateMember(memberId: string, patch: Partial<Pick<Member, "name" | "title" | "position" | "number" | "groups" | "role">>) {
    mutate((d) => {
      requireCommission(d);
      Object.assign(d.members.find((m) => m.id === memberId)!, patch);
    });
  },

  async removeMember(memberId: string) {
    mutate((d) => {
      const me = requireCommission(d);
      if (me.id === memberId) throw new Error("Você não pode remover a si mesmo.");
      d.members = d.members.filter((m) => m.id !== memberId);
    });
  },

  async updateProfile(patch: { name: string }) {
    mutate((d) => {
      const me = requireMe(d);
      me.name = patch.name.trim() || me.name;
    });
  },

  async changePassword(current: string, next: string) {
    const [currentHash, nextHash] = await Promise.all([hash(current), hash(next)]);
    mutate((d) => {
      const me = requireMe(d);
      if (me.passwordHash !== currentHash) throw new Error("A senha atual está incorreta.");
      me.passwordHash = nextHash;
    });
  },

  // ----- reuniões -----
  async createMeeting(input: NewMeetingInput) {
    return mutate((d) => {
      const me = requireCommission(d);
      const meeting: Meeting = {
        id: uid(),
        teamId: me.teamId,
        title: input.title.trim(),
        opponent: input.opponent.trim(),
        audience: input.audience,
        invitedIds: resolveInvited(d, me.teamId, input.audience, me.id),
        agenda: input.agenda.filter((item) => item.title.trim()),
        startsAt: input.startNow ? now() : input.startsAt,
        duration: input.duration,
        record: input.record,
        callUrl: input.callUrl.trim(),
        status: input.startNow ? "live" : "scheduled",
        createdBy: me.id,
        createdAt: now(),
        startedAt: input.startNow ? now() : undefined,
        currentItem: 0,
        itemStartedAt: input.startNow ? now() : undefined,
        joinedIds: input.startNow ? [me.id] : [],
        notes: "",
      };
      d.meetings.push(meeting);
      notify(
        d,
        meeting.invitedIds.filter((id) => id !== me.id),
        input.startNow ? `Reunião ao vivo agora: ${meeting.title}` : `Você foi convidado: ${meeting.title}`,
        `/reunioes/${meeting.id}`,
      );
      return meeting;
    });
  },

  async deleteMeeting(meetingId: string) {
    mutate((d) => {
      requireCommission(d);
      d.meetings = d.meetings.filter((m) => m.id !== meetingId);
      d.rsvps = d.rsvps.filter((r) => r.meetingId !== meetingId);
      d.notifications = d.notifications.filter((n) => !n.route.includes(meetingId));
    });
  },

  async rsvp(meetingId: string, going: boolean) {
    mutate((d) => {
      const me = requireMe(d);
      d.rsvps = d.rsvps.filter((r) => !(r.meetingId === meetingId && r.memberId === me.id));
      d.rsvps.push({ meetingId, memberId: me.id, going, at: now() });
    });
  },

  async startMeeting(meetingId: string) {
    mutate((d) => {
      const me = requireCommission(d);
      const meeting = requireMeeting(d, meetingId);
      meeting.status = "live";
      meeting.startedAt = now();
      meeting.itemStartedAt = now();
      meeting.currentItem = 0;
      if (!meeting.joinedIds.includes(me.id)) meeting.joinedIds.push(me.id);
      notify(d, meeting.invitedIds.filter((id) => id !== me.id), `Reunião ao vivo agora: ${meeting.title}`, `/reunioes/${meeting.id}/sala`);
    });
  },

  async joinMeeting(meetingId: string) {
    mutate((d) => {
      const me = requireMe(d);
      const meeting = requireMeeting(d, meetingId);
      if (!meeting.joinedIds.includes(me.id)) meeting.joinedIds.push(me.id);
    });
  },

  async setAgendaItem(meetingId: string, index: number) {
    mutate((d) => {
      requireCommission(d);
      const meeting = requireMeeting(d, meetingId);
      meeting.currentItem = Math.max(0, Math.min(index, meeting.agenda.length - 1));
      meeting.itemStartedAt = now();
    });
  },

  async saveNotes(meetingId: string, notes: string) {
    mutate((d) => {
      requireCommission(d);
      requireMeeting(d, meetingId).notes = notes;
    });
  },

  async sendChat(meetingId: string, text: string) {
    const value = text.trim();
    if (!value) return;
    mutate((d) => {
      const me = requireMe(d);
      d.chat.push({ id: uid(), meetingId, memberId: me.id, text: value, at: now() });
    });
  },

  async endMeeting(meetingId: string) {
    mutate((d) => {
      requireCommission(d);
      const meeting = requireMeeting(d, meetingId);
      meeting.status = "ended";
      meeting.endedAt = now();
    });
  },

  async publishSummary(meetingId: string, input: { text: string; decisions: string[]; attendance: string[]; tasks: TaskInput[] }) {
    mutate((d) => {
      const me = requireCommission(d);
      const meeting = requireMeeting(d, meetingId);
      meeting.status = "published";
      meeting.endedAt ??= now();
      meeting.summary = {
        text: input.text.trim(),
        decisions: input.decisions.map((x) => x.trim()).filter(Boolean),
        attendance: input.attendance,
        publishedAt: now(),
        publishedBy: me.id,
      };
      for (const task of input.tasks) {
        if (!task.title.trim() || !task.assigneeId) continue;
        const id = uid();
        d.tasks.push({ id, teamId: me.teamId, meetingId, ...task, title: task.title.trim(), status: "pending", createdAt: now() });
        notify(d, [task.assigneeId], `Nova tarefa: ${task.title.trim()}`, `/tarefas/${id}`);
      }
      notify(d, meeting.invitedIds.filter((id) => id !== me.id), `Resumo publicado: ${meeting.title}`, `/reunioes/${meeting.id}/resumo`);
    });
  },

  async acknowledge(meetingId: string) {
    mutate((d) => {
      const me = requireMe(d);
      if (!d.acks.some((a) => a.meetingId === meetingId && a.memberId === me.id))
        d.acks.push({ meetingId, memberId: me.id, at: now() });
    });
  },

  async remindPending(meetingId: string) {
    return mutate((d) => {
      requireCommission(d);
      const meeting = requireMeeting(d, meetingId);
      const pending = meeting.invitedIds.filter(
        (id) => id !== meeting.summary?.publishedBy && !d.acks.some((a) => a.meetingId === meetingId && a.memberId === id),
      );
      notify(d, pending, `Lembrete: confirme a leitura do resumo "${meeting.title}"`, `/reunioes/${meeting.id}/resumo`);
      return pending.length;
    });
  },

  // ----- tarefas -----
  async completeTask(taskId: string) {
    mutate((d) => {
      const me = requireMe(d);
      const task = d.tasks.find((t) => t.id === taskId);
      if (!task) throw new Error("Tarefa não encontrada.");
      if (task.assigneeId !== me.id) throw new Error("Só o responsável pode concluir a tarefa.");
      task.status = "done";
      task.doneAt = now();
      const meeting = d.meetings.find((m) => m.id === task.meetingId);
      if (meeting) notify(d, [meeting.createdBy], `${me.name} concluiu: ${task.title}`, `/reunioes/${meeting.id}/resumo`);
    });
  },

  // ----- notificações -----
  async markRead(notificationId: string) {
    mutate((d) => {
      const n = d.notifications.find((x) => x.id === notificationId);
      if (n && !n.readAt) n.readAt = now();
    });
  },

  async markAllRead() {
    mutate((d) => {
      const me = requireMe(d);
      for (const n of d.notifications) if (n.memberId === me.id && !n.readAt) n.readAt = now();
    });
  },

  // ----- gravações -----
  async saveRecording(input: { meetingId: string; durationSec: number; mimeType: string; chapters: Chapter[] }, file: Blob) {
    const id = uid();
    await blobs.put(id, file);
    return mutate((d) => {
      const me = requireCommission(d);
      const meeting = requireMeeting(d, input.meetingId);
      const recording: Recording = {
        id,
        teamId: me.teamId,
        meetingId: meeting.id,
        createdBy: me.id,
        createdAt: now(),
        durationSec: Math.round(input.durationSec),
        size: file.size,
        mimeType: input.mimeType,
        chapters: input.chapters,
        notes: [],
        visibility: "invited",
      };
      d.recordings.push(recording);
      return recording;
    });
  },

  async setRecordingVisibility(id: string, visibility: Recording["visibility"]) {
    mutate((d) => {
      requireCommission(d);
      const rec = d.recordings.find((r) => r.id === id)!;
      const was = rec.visibility;
      rec.visibility = visibility;
      if (was !== "team" && visibility === "team") {
        const meeting = d.meetings.find((m) => m.id === rec.meetingId);
        const others = d.members.filter((m) => m.teamId === rec.teamId && !meeting?.invitedIds.includes(m.id)).map((m) => m.id);
        notify(d, others, `Nova gravação liberada: ${meeting?.title ?? "reunião"}`, `/gravacoes/${rec.id}`);
      }
    });
  },

  async addRecordingNote(id: string, t: number, text: string) {
    const value = text.trim();
    if (!value) return;
    mutate((d) => {
      const me = requireCommission(d);
      const rec = d.recordings.find((r) => r.id === id)!;
      rec.notes.push({ id: uid(), t: Math.max(0, Math.round(t)), text: value, authorId: me.id, at: now() });
      rec.notes.sort((a, b) => a.t - b.t);
    });
  },

  async removeRecordingNote(id: string, noteId: string) {
    mutate((d) => {
      requireCommission(d);
      const rec = d.recordings.find((r) => r.id === id)!;
      rec.notes = rec.notes.filter((n) => n.id !== noteId);
    });
  },

  async deleteRecording(id: string) {
    mutate((d) => {
      requireCommission(d);
      d.recordings = d.recordings.filter((r) => r.id !== id);
    });
    await blobs.remove(id).catch(() => undefined);
  },

  // ----- lousa e playbook -----
  async savePlay(input: PlayInput, playId?: string) {
    return mutate((d) => {
      const me = requireCommission(d);
      const existing = playId ? d.plays.find((p) => p.id === playId && p.teamId === me.teamId) : undefined;
      const play: Play = {
        ...(existing ?? { id: uid(), teamId: me.teamId, createdBy: me.id }),
        ...input,
        name: input.name.trim(),
        formation: input.formation.trim(),
        updatedAt: now(),
      } as Play;
      if (existing) Object.assign(existing, play);
      else d.plays.push(play);
      if (input.published && !existing?.published) {
        const targets = d.members.filter(
          (m) => m.teamId === me.teamId && m.id !== me.id && (!play.groups.length || m.groups.some((g) => play.groups.includes(g))),
        );
        notify(d, targets.map((m) => m.id), `Nova jogada no playbook: ${play.name}`, `/playbook/${play.id}`);
      }
      return play;
    });
  },

  async deletePlay(id: string) {
    mutate((d) => {
      requireCommission(d);
      d.plays = d.plays.filter((p) => p.id !== id);
    });
  },

  // ----- teste local -----
  resetAll() {
    try {
      localStorage.removeItem(DATA_KEY);
    } catch {
      // nada a limpar
    }
    blobs.clear().catch(() => undefined);
    data = empty();
    setSession(null);
  },
};
