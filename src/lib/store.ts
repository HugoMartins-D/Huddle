/*
 * Camada de dados do frontend. Os dados ficam na API do HUDDLE (server/, no ZimaOS);
 * as telas falam apenas com `api` e `useStore`.
 *
 * A sessão fica no sessionStorage: cada aba pode estar logada com uma pessoa
 * diferente (útil para testar comissão e atleta lado a lado). Mudanças feitas por
 * outras pessoas chegam por /api/events e a tela busca o estado de novo.
 */
import { useSyncExternalStore } from "react";
import { resolveInvited } from "./selectors";
import type { AgendaItem, Audience, Chapter, Data, Meeting, Member, Play, Recording, Role, Team } from "./types";

export { resolveInvited };

/** Endereço da API. Vazio = mesmo endereço do app (no desenvolvimento o Vite repassa /api). */
const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/$/, "");
const SESSION_KEY = "huddle:sessao";

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

type Session = { token: string; memberId: string };
type State = { v: number; memberId: string; data: Data };

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let data = empty();
let version = -1;
let session = loadSession();
let loading = Boolean(session);
let snapshot = { data, sessionId: session?.memberId ?? null, loading };
const listeners = new Set<() => void>();

function emit() {
  snapshot = { data, sessionId: session?.memberId ?? null, loading };
  listeners.forEach((listener) => listener());
}

function applyState(state: State) {
  data = state.data;
  version = state.v;
  loading = false;
  emit();
}

function setSession(next: Session | null) {
  session = next;
  try {
    if (next) sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // sem sessionStorage a sessão vale só enquanto a página estiver aberta
  }
  if (!next) {
    data = empty();
    version = -1;
    loading = false;
  }
  connectEvents();
  emit();
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (session) headers.set("Authorization", `Bearer ${session.token}`);
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new Error("Sem conexão com o servidor do HUDDLE. Confira sua internet e tente de novo.");
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && session && !path.startsWith("/api/auth/")) setSession(null);
  if (!res.ok) throw new Error(body.error ?? "Erro no servidor. Tente de novo.");
  return body as T;
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) });

/** Executa uma ação no servidor e já aplica o estado novo que ele devolve. */
async function call<T = void>(name: string, ...args: unknown[]): Promise<T> {
  const out = await post<{ result: T; state: State }>(`/api/actions/${name}`, args);
  applyState(out.state);
  return out.result;
}

async function refresh() {
  if (!session) return;
  try {
    applyState(await request<State>("/api/state"));
  } catch {
    // sem conexão: tenta de novo no próximo aviso do servidor
  }
}

// ---------- atualizações ao vivo ----------

let events: EventSource | null = null;
function connectEvents() {
  events?.close();
  events = null;
  if (!session) return;
  events = new EventSource(`${API_URL}/api/events?token=${encodeURIComponent(session.token)}`);
  events.onmessage = (event) => {
    const { v } = JSON.parse(event.data);
    if (v !== version) refresh();
  };
}

window.addEventListener("storage", (event) => {
  // Outra aba saiu da conta (o sessionStorage é por aba; isto cobre o login no mesmo navegador).
  if (event.key === SESSION_KEY && !event.newValue && session && !loadSession()) setSession(null);
});

if (session) {
  connectEvents();
  refresh();
}

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
  const { data, sessionId, loading } = useStore();
  const me = data.members.find((m) => m.id === sessionId && m.status === "active");
  const team = me ? data.teams.find((t) => t.id === me.teamId) : undefined;
  return { data, me, team, loading };
}

export function inviteLink(member: Member) {
  return `${location.origin}${location.pathname}#/convite/${member.inviteToken}`;
}

/** Endereço do vídeo de uma gravação (o player não envia cabeçalhos, então a sessão vai na URL). */
export function recordingUrl(id: string) {
  return `${API_URL}/api/recordings/${id}/file?token=${encodeURIComponent(session?.token ?? "")}`;
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

export type InviteInfo = {
  member: Pick<Member, "name" | "email" | "title" | "position" | "number" | "status">;
  team?: Team;
  invitedBy?: { name: string };
  used: boolean;
  expired: boolean;
};

type AuthResult = { token: string; state: State };

function startSession(out: AuthResult) {
  setSession({ token: out.token, memberId: out.state.memberId });
  applyState(out.state);
}

export const api = {
  // ----- acesso -----
  async registerTeam(input: {
    team: Pick<Team, "name" | "sport" | "color" | "crest">;
    me: { name: string; email: string; password: string; title: string };
  }) {
    startSession(await post<AuthResult>("/api/auth/register", input));
  },

  async login(email: string, password: string) {
    startSession(await post<AuthResult>("/api/auth/login", { email, password }));
  },

  logout() {
    setSession(null);
  },

  async findInvite(inviteToken: string): Promise<InviteInfo | null> {
    try {
      return await request<InviteInfo>(`/api/invites/${encodeURIComponent(inviteToken)}`);
    } catch (error) {
      if (error instanceof Error && error.message === "Convite não encontrado.") return null;
      throw error;
    }
  },

  async activateInvite(inviteToken: string, input: { name: string; password: string }) {
    startSession(await post<AuthResult>(`/api/invites/${encodeURIComponent(inviteToken)}/activate`, input));
  },

  async requestNewInvite(inviteToken: string) {
    await post(`/api/invites/${encodeURIComponent(inviteToken)}/request-new`, {});
  },

  async requestPasswordReset(email: string) {
    await post("/api/auth/recover", { email });
  },

  // ----- time -----
  updateTeam: (patch: Partial<Pick<Team, "name" | "sport" | "color" | "crest">>) => call("updateTeam", patch),
  addGroup: (name: string) => call("addGroup", name),
  removeGroup: (name: string) => call("removeGroup", name),

  // ----- elenco -----
  inviteMember: (input: NewMemberInput) => call<Member>("inviteMember", input),
  renewInvite: (memberId: string) => call<Member>("renewInvite", memberId),
  updateMember: (memberId: string, patch: Partial<Pick<Member, "name" | "title" | "position" | "number" | "groups" | "role">>) =>
    call("updateMember", memberId, patch),
  removeMember: (memberId: string) => call("removeMember", memberId),
  updateProfile: (patch: { name: string }) => call("updateProfile", patch),
  async changePassword(current: string, next: string) {
    await post("/api/me/password", { current, next });
  },

  // ----- reuniões -----
  createMeeting: (input: NewMeetingInput) => call<Meeting>("createMeeting", input),
  deleteMeeting: (meetingId: string) => call("deleteMeeting", meetingId),
  rsvp: (meetingId: string, going: boolean) => call("rsvp", meetingId, going),
  startMeeting: (meetingId: string) => call("startMeeting", meetingId),
  joinMeeting: (meetingId: string) => call("joinMeeting", meetingId),
  setAgendaItem: (meetingId: string, index: number) => call("setAgendaItem", meetingId, index),
  saveNotes: (meetingId: string, notes: string) => call("saveNotes", meetingId, notes),
  async sendChat(meetingId: string, text: string) {
    if (text.trim()) await call("sendChat", meetingId, text);
  },
  endMeeting: (meetingId: string) => call("endMeeting", meetingId),
  publishSummary: (meetingId: string, input: { text: string; decisions: string[]; attendance: string[]; tasks: TaskInput[] }) =>
    call("publishSummary", meetingId, input),
  acknowledge: (meetingId: string) => call("acknowledge", meetingId),
  remindPending: (meetingId: string) => call<number>("remindPending", meetingId),

  // ----- tarefas -----
  completeTask: (taskId: string) => call("completeTask", taskId),

  // ----- notificações -----
  markRead: (notificationId: string) => call("markRead", notificationId),
  markAllRead: () => call("markAllRead"),

  // ----- gravações -----
  async saveRecording(input: { meetingId: string; durationSec: number; mimeType: string; chapters: Chapter[] }, file: Blob) {
    const params = new URLSearchParams({
      meetingId: input.meetingId,
      durationSec: String(Math.round(input.durationSec)),
      mimeType: input.mimeType,
      chapters: JSON.stringify(input.chapters),
    });
    const out = await request<{ result: Recording; state: State }>(`/api/recordings?${params}`, {
      method: "POST",
      body: file,
      headers: { "Content-Type": "application/octet-stream" },
    });
    applyState(out.state);
    return out.result;
  },
  setRecordingVisibility: (id: string, visibility: Recording["visibility"]) => call("setRecordingVisibility", id, visibility),
  async addRecordingNote(id: string, t: number, text: string) {
    if (text.trim()) await call("addRecordingNote", id, t, text);
  },
  removeRecordingNote: (id: string, noteId: string) => call("removeRecordingNote", id, noteId),
  deleteRecording: (id: string) => call("deleteRecording", id),

  // ----- vídeo -----
  livekitToken: (meetingId: string) => request<{ token: string }>(`/api/livekit/token?meetingId=${encodeURIComponent(meetingId)}`),

  // ----- lousa e playbook -----
  savePlay: (input: PlayInput, playId?: string) => call<Play>("savePlay", input, playId),
  deletePlay: (id: string) => call("deletePlay", id),
};
