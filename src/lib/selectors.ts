import type { Audience, Data, Meeting, Member } from "./types";

/*
 * Funções puras sobre os dados — usadas pelas telas e também pelo servidor (server/),
 * por isso aqui só entram imports de tipo.
 */

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

export function teamMembers(data: Data, teamId: string) {
  return data.members.filter((m) => m.teamId === teamId);
}

export function memberName(data: Data, id: string) {
  return data.members.find((m) => m.id === id)?.name ?? "Pessoa removida";
}

/** Reuniões que a pessoa pode ver: comissão vê todas do time; atleta só as que foi convidado. */
export function visibleMeetings(data: Data, me: Member) {
  return data.meetings
    .filter((m) => m.teamId === me.teamId && (me.role === "commission" || m.invitedIds.includes(me.id)))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export const isUpcoming = (m: Meeting) => m.status === "scheduled" || m.status === "live";

export function rsvpOf(data: Data, meetingId: string, memberId: string) {
  return data.rsvps.find((r) => r.meetingId === meetingId && r.memberId === memberId);
}

export function ackOf(data: Data, meetingId: string, memberId: string) {
  return data.acks.find((a) => a.meetingId === meetingId && a.memberId === memberId);
}

/** Quem precisa confirmar ciência: convidados, menos quem publicou. */
export function ackAudience(meeting: Meeting) {
  return meeting.invitedIds.filter((id) => id !== meeting.summary?.publishedBy);
}

export function audienceLabel(meeting: Meeting) {
  const a = meeting.audience;
  if (a.kind === "all") return "Time todo";
  if (a.kind === "commission") return "Comissão técnica";
  if (a.kind === "groups") return a.groups.join(", ");
  return `${a.memberIds.length} ${a.memberIds.length === 1 ? "pessoa" : "pessoas"}`;
}

export function statusLabel(meeting: Meeting) {
  return { scheduled: "Agendada", live: "Ao vivo", ended: "Encerrada", published: "Resumo publicado" }[meeting.status];
}

export function athletePending(data: Data, me: Member) {
  const meetings = visibleMeetings(data, me);
  return {
    rsvp: meetings.filter((m) => m.status === "scheduled" && !rsvpOf(data, m.id, me.id)),
    summaries: meetings.filter((m) => m.status === "published" && !ackOf(data, m.id, me.id)),
    tasks: data.tasks.filter((t) => t.assigneeId === me.id && t.status === "pending"),
  };
}

export function visibleRecordings(data: Data, me: Member) {
  return data.recordings
    .filter((r) => {
      if (r.teamId !== me.teamId) return false;
      if (me.role === "commission" || r.visibility === "team") return true;
      return data.meetings.find((m) => m.id === r.meetingId)?.invitedIds.includes(me.id) ?? false;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Atleta vê jogadas publicadas sem grupo definido ou de algum grupo dele. */
export function visiblePlays(data: Data, me: Member) {
  return data.plays
    .filter((p) => p.teamId === me.teamId)
    .filter((p) => me.role === "commission" || (p.published && (!p.groups.length || p.groups.some((g) => me.groups.includes(g)))))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function unreadCount(data: Data, me: Member) {
  return data.notifications.filter((n) => n.memberId === me.id && !n.readAt).length;
}
