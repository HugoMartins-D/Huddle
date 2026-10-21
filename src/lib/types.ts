export type Role = "commission" | "athlete";

export type Team = {
  id: string;
  name: string;
  sport: string;
  color: string;
  crest?: string;
  /** Grupos livres do time (ex.: setores, posições, categorias). Definem o público das reuniões. */
  groups: string[];
  createdAt: string;
};

export type Member = {
  id: string;
  teamId: string;
  name: string;
  email: string;
  passwordHash?: string;
  role: Role;
  /** Função exibida: Presidente, Head Coach, Atleta, Capitão… (texto livre) */
  title: string;
  position: string;
  number: string;
  groups: string[];
  status: "invited" | "active";
  inviteToken: string;
  inviteExpiresAt: string;
  consentAt?: string;
  createdAt: string;
};

export type Audience = {
  kind: "all" | "commission" | "groups" | "members";
  groups: string[];
  memberIds: string[];
};

export type AgendaItem = { id: string; title: string; minutes: number };

export type MeetingStatus = "scheduled" | "live" | "ended" | "published";

export type Summary = {
  text: string;
  decisions: string[];
  attendance: string[];
  publishedAt: string;
  publishedBy: string;
};

export type Meeting = {
  id: string;
  teamId: string;
  title: string;
  opponent: string;
  audience: Audience;
  invitedIds: string[];
  agenda: AgendaItem[];
  startsAt: string;
  duration: 30 | 45 | 60;
  record: boolean;
  callUrl: string;
  status: MeetingStatus;
  createdBy: string;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  currentItem: number;
  itemStartedAt?: string;
  joinedIds: string[];
  notes: string;
  summary?: Summary;
};

export type Rsvp = { meetingId: string; memberId: string; going: boolean; at: string };
export type Ack = { meetingId: string; memberId: string; at: string };

export type Task = {
  id: string;
  teamId: string;
  meetingId: string;
  title: string;
  description: string;
  assigneeId: string;
  due: string;
  status: "pending" | "done";
  doneAt?: string;
  createdAt: string;
};

export type Notification = {
  id: string;
  memberId: string;
  text: string;
  route: string;
  createdAt: string;
  readAt?: string;
};

export type ChatMessage = { id: string; meetingId: string; memberId: string; text: string; at: string };

export type Chapter = { t: number; title: string };
export type RecordingNote = { id: string; t: number; text: string; authorId: string; at: string };

export type Recording = {
  id: string;
  teamId: string;
  meetingId: string;
  createdBy: string;
  createdAt: string;
  durationSec: number;
  size: number;
  mimeType: string;
  chapters: Chapter[];
  notes: RecordingNote[];
  /** Quem pode assistir: só os convidados da reunião ou o time todo. */
  visibility: "invited" | "team";
};

export type FieldKind = "gridiron" | "soccer" | "court" | "blank";

/** Coordenadas no espaço da lousa: 1000 × 600. */
export type BoardElement =
  | { id: string; kind: "player"; x: number; y: number; side: "a" | "b"; label: string; color: string }
  | { id: string; kind: "route"; points: [number, number][]; color: string; style: "solid" | "dashed" | "block" }
  | { id: string; kind: "text"; x: number; y: number; text: string; color: string }
  /** Bola de flag football — no máximo uma por jogada. */
  | { id: string; kind: "ball"; x: number; y: number };

export type Play = {
  id: string;
  teamId: string;
  name: string;
  formation: string;
  groups: string[];
  notes: string;
  field: FieldKind;
  elements: BoardElement[];
  published: boolean;
  createdBy: string;
  updatedAt: string;
};

export type Data = {
  teams: Team[];
  members: Member[];
  meetings: Meeting[];
  rsvps: Rsvp[];
  acks: Ack[];
  tasks: Task[];
  notifications: Notification[];
  chat: ChatMessage[];
  recordings: Recording[];
  plays: Play[];
};
