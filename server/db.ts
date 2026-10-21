/*
 * Banco do HUDDLE: um arquivo SQLite (node:sqlite, sem dependências).
 *
 * Cada registro do app (time, pessoa, reunião…) é um documento JSON numa única
 * tabela `docs`, marcado com o time a que pertence. O servidor carrega o time
 * inteiro, aplica a ação e grava só os documentos que mudaram — a mesma forma de
 * trabalhar que o frontend tinha com o localStorage, agora num lugar só.
 */
import { mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Data, Member } from "../src/lib/types";

/** No Docker é /data. No desenvolvimento fica fora da pasta do projeto: SQLite em pasta de rede (SMB) corrompe. */
export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(homedir(), ".huddle-dados"));
export const RECORDINGS_DIR = path.join(DATA_DIR, "recordings");
mkdirSync(RECORDINGS_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "huddle.db"));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS docs (
    collection TEXT NOT NULL,
    id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (collection, id)
  );
  CREATE INDEX IF NOT EXISTS docs_team ON docs (team_id);
  CREATE INDEX IF NOT EXISTS docs_member_email ON docs (json_extract(data, '$.email')) WHERE collection = 'members';
  CREATE INDEX IF NOT EXISTS docs_member_invite ON docs (json_extract(data, '$.inviteToken')) WHERE collection = 'members';
`);

const COLLECTIONS = ["teams", "members", "meetings", "rsvps", "acks", "tasks", "notifications", "chat", "recordings", "plays"] as const;
type Collection = (typeof COLLECTIONS)[number];

export const emptyData = (): Data => ({
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

/** Presença e ciência não têm id próprio: a chave é reunião + pessoa. */
function keyOf(doc: { id?: string; meetingId?: string; memberId?: string }) {
  return doc.id ?? `${doc.meetingId}:${doc.memberId}`;
}

const selectTeam = db.prepare("SELECT collection, data FROM docs WHERE team_id = ?");
const upsert = db.prepare(
  "INSERT INTO docs (collection, id, team_id, data) VALUES (?, ?, ?, ?) ON CONFLICT (collection, id) DO UPDATE SET data = excluded.data, team_id = excluded.team_id",
);
const remove = db.prepare("DELETE FROM docs WHERE collection = ? AND id = ?");
const byEmail = db.prepare("SELECT team_id, data FROM docs WHERE collection = 'members' AND json_extract(data, '$.email') = ?");
const byInvite = db.prepare("SELECT team_id, data FROM docs WHERE collection = 'members' AND json_extract(data, '$.inviteToken') = ?");

export function loadTeam(teamId: string): Data {
  const d = emptyData();
  for (const row of selectTeam.all(teamId) as { collection: Collection; data: string }[]) {
    (d[row.collection] as unknown[]).push(JSON.parse(row.data));
  }
  return d;
}

/** Grava as diferenças entre dois estados do mesmo time, numa transação. */
export function saveTeam(teamId: string, before: Data, after: Data) {
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const collection of COLLECTIONS) {
      const old = new Map((before[collection] as { id?: string }[]).map((doc) => [keyOf(doc), JSON.stringify(doc)]));
      for (const doc of after[collection] as { id?: string }[]) {
        const key = keyOf(doc);
        const json = JSON.stringify(doc);
        if (old.get(key) !== json) upsert.run(collection, key, teamId, json);
        old.delete(key);
      }
      for (const key of old.keys()) remove.run(collection, key);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function findMemberByEmail(email: string) {
  const row = byEmail.get(email) as { team_id: string; data: string } | undefined;
  return row ? (JSON.parse(row.data) as Member) : undefined;
}

export function findMemberByInvite(token: string) {
  if (!token) return undefined;
  const row = byInvite.get(token) as { team_id: string; data: string } | undefined;
  return row ? (JSON.parse(row.data) as Member) : undefined;
}

export const recordingPath = (id: string) => path.join(RECORDINGS_DIR, `${id.replace(/[^\w-]/g, "")}.bin`);

export function removeRecordingFile(id: string) {
  rmSync(recordingPath(id), { force: true });
}
