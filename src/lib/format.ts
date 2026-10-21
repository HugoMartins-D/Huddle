const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const pad = (n: number) => String(n).padStart(2, "0");

function dayDiff(date: Date) {
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const t = new Date();
  const b = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((a.getTime() - b.getTime()) / 864e5);
}

export function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDay(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = dayDiff(d);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())} ${MONTHS[d.getMonth()]}`;
}

export function fmtDateTime(iso: string) {
  return `${fmtDay(iso)} · ${fmtTime(iso)}`;
}

export function fmtRange(iso: string, minutes: number) {
  const end = new Date(new Date(iso).getTime() + minutes * 60e3).toISOString();
  return `${fmtDay(iso)} · ${fmtTime(iso)}–${fmtTime(end)}`;
}

/** Prazo no formato yyyy-mm-dd (sem fuso). */
export function parseDue(due: string) {
  const [y, m, d] = due.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function fmtDue(due: string) {
  const d = parseDue(due);
  const diff = dayDiff(d);
  if (diff === 0) return "até hoje";
  if (diff === 1) return "até amanhã";
  return `até ${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())} ${MONTHS[d.getMonth()]}`;
}

export function isOverdue(due: string) {
  return dayDiff(parseDue(due)) < 0;
}

export function fmtAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return fmtDay(iso);
}

export function fmtClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Valor para <input type="datetime-local"> */
export function toLocalInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}
