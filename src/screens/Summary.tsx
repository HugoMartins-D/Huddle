import { FormEvent, useState } from "react";
import { BellRing, Check, CheckCircle2, ChevronRight, NotebookPen, PlayCircle, Plus, Send, X } from "lucide-react";
import { Avatar, Badge, Button, Card, CheckRow, ErrorText, Field, ICON, PageHeader, useAction } from "../components/ui";
import { fmtClock, fmtDateTime, fmtDue, fmtRange, fmtTime, isOverdue, plural, toDateInput } from "../lib/format";
import { Link, go } from "../lib/router";
import { ackAudience, ackOf, memberName, teamMembers, visibleRecordings } from "../lib/selectors";
import { api, type TaskInput } from "../lib/store";
import type { Data, Meeting, Member } from "../lib/types";

// ---------------- Encerrar e publicar ----------------

const inAWeek = () => toDateInput(new Date(Date.now() + 7 * 864e5));
const emptyTask = (): TaskInput & { key: string } => ({ key: crypto.randomUUID(), title: "", description: "", assigneeId: "", due: inAWeek() });

export function CloseMeeting({ data, me, meeting }: { data: Data; me: Member; meeting: Meeting }) {
  const [text, setText] = useState("");
  const [decisions, setDecisions] = useState<string[]>([""]);
  const [tasks, setTasks] = useState([emptyTask()]);
  const [attendance, setAttendance] = useState<string[]>(meeting.joinedIds);
  const { busy, error, setError, run } = useAction();
  const people = teamMembers(data, meeting.teamId);
  const invited = meeting.invitedIds.map((id) => people.find((m) => m.id === id)).filter(Boolean) as Member[];

  async function submit(e: FormEvent) {
    e.preventDefault();
    const incomplete = tasks.find((t) => t.title.trim() && !t.assigneeId);
    if (incomplete) return setError(`Escolha o responsável por "${incomplete.title.trim()}".`);
    if (!text.trim() && !decisions.some((d) => d.trim())) return setError("Escreva o resumo ou registre pelo menos uma decisão.");
    if (await run(() => api.publishSummary(meeting.id, { text, decisions, attendance, tasks: tasks.map(({ key: _key, ...t }) => t) }))) go(`/reunioes/${meeting.id}/resumo`);
  }

  const setTask = (key: string, patch: Partial<TaskInput>) => setTasks((list) => list.map((t) => (t.key === key ? { ...t, ...patch } : t)));

  return (
    <form onSubmit={submit}>
      <PageHeader back="/reunioes" eyebrow={meeting.status === "live" ? "Ao vivo" : "Reunião encerrada"} title="Encerrar e publicar" subtitle={`${meeting.title} · ${fmtRange(meeting.startsAt, meeting.duration)}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card
            title="Resumo"
            action={
              meeting.notes.trim() && (
                <Button small icon={NotebookPen} onClick={() => setText((t) => (t.trim() ? `${t}\n\n${meeting.notes}` : meeting.notes))}>
                  Usar minhas notas
                </Button>
              )
            }
          >
            <textarea className="input min-h-32" value={text} onChange={(e) => setText(e.target.value)} placeholder="O que foi discutido, escrito pela comissão para o time." />
          </Card>

          <Card title="Decisões">
            <div className="space-y-2">
              {decisions.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent/15 text-xs font-bold text-accent">{i + 1}</span>
                  <input className="input" value={d} onChange={(e) => setDecisions((list) => list.map((x, j) => (j === i ? e.target.value : x)))} placeholder="Decisão tomada" />
                  <button type="button" onClick={() => setDecisions((list) => list.filter((_, j) => j !== i))} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:text-danger" title="Remover">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <Button small icon={Plus} className="mt-3" onClick={() => setDecisions((list) => [...list, ""])}>
              Adicionar decisão
            </Button>
          </Card>

          <Card title="Próximos passos">
            <div className="space-y-3">
              {tasks.map((t) => (
                <div key={t.key} className="rounded-xl border border-line bg-surface-2 p-3">
                  <div className="flex items-start gap-2">
                    <input className="input" value={t.title} onChange={(e) => setTask(t.key, { title: e.target.value })} placeholder="O que precisa ser feito" />
                    <button type="button" onClick={() => setTasks((list) => list.filter((x) => x.key !== t.key))} className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:text-danger" title="Remover">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <select className="input" value={t.assigneeId} onChange={(e) => setTask(t.key, { assigneeId: e.target.value })}>
                      <option value="">Responsável…</option>
                      {invited.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <input className="input" type="date" value={t.due} onChange={(e) => setTask(t.key, { due: e.target.value })} required={!!t.title.trim()} />
                  </div>
                  <textarea className="input mt-2 min-h-16" value={t.description} onChange={(e) => setTask(t.key, { description: e.target.value })} placeholder="Orientação para o responsável (opcional)" />
                </div>
              ))}
            </div>
            <Button small icon={Plus} className="mt-3" onClick={() => setTasks((list) => [...list, emptyTask()])}>
              Adicionar próximo passo
            </Button>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card title="Presença" action={<span className="text-xs text-muted">{attendance.length} de {invited.length}</span>}>
            <div className="max-h-80 overflow-y-auto">
              {invited.map((m) => (
                <CheckRow key={m.id} checked={attendance.includes(m.id)} onChange={(v) => setAttendance((list) => (v ? [...list, m.id] : list.filter((x) => x !== m.id)))}>
                  <span className="text-sm">{m.name}</span>
                </CheckRow>
              ))}
            </div>
          </Card>
          <p className="text-xs text-muted">Os convidados recebem uma notificação no app e precisam marcar “Estou ciente”. Cada responsável recebe a sua tarefa.</p>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" variant="primary" icon={Send} className="w-full" disabled={busy}>
            Publicar resumo
          </Button>
        </aside>
      </div>
    </form>
  );
}

// ---------------- Resumo ----------------

export function SummaryView({ data, me, meeting }: { data: Data; me: Member; meeting: Meeting }) {
  const summary = meeting.summary!;
  const isCommission = me.role === "commission";
  const allTasks = data.tasks.filter((t) => t.meetingId === meeting.id);
  const tasks = isCommission ? allTasks : allTasks.filter((t) => t.assigneeId === me.id);
  const myAck = ackOf(data, meeting.id, me.id);
  const needsAck = !isCommission || (meeting.invitedIds.includes(me.id) && me.id !== summary.publishedBy);

  return (
    <>
      <PageHeader
        back="/reunioes"
        eyebrow="Resumo da reunião"
        title={meeting.title}
        subtitle={`${fmtRange(meeting.startsAt, meeting.duration)} · publicado por ${memberName(data, summary.publishedBy)}`}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {summary.text && (
            <Card title="Resumo">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink/90">{summary.text}</p>
            </Card>
          )}
          <Card title="Decisões">
            {summary.decisions.length ? (
              <ol className="space-y-2">
                {summary.decisions.map((d, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl bg-surface-2 px-3.5 py-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent/15 text-xs font-bold text-accent">{i + 1}</span>
                    <span className="text-sm">{d}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">Nenhuma decisão registrada.</p>
            )}
          </Card>
          <Card title={isCommission ? "Próximos passos" : "Seu próximo passo"}>
            {tasks.length ? (
              <ul className="space-y-2">
                {tasks.map((t) => (
                  <li key={t.id}>
                    <Link to={`/tarefas/${t.id}`} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-3 hover:bg-surface-3">
                      <span className={`grid size-5 shrink-0 place-items-center rounded-md border ${t.status === "done" ? "border-accent bg-accent text-on-accent" : "border-line-2"}`}>
                        {t.status === "done" && <Check size={13} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm ${t.status === "done" ? "text-muted line-through" : ""}`}>{t.title}</span>
                        {isCommission && <span className="block truncate text-xs text-muted">{memberName(data, t.assigneeId)}</span>}
                      </span>
                      <span className={`text-xs ${t.status === "pending" && isOverdue(t.due) ? "text-danger" : "text-muted"}`}>{t.status === "done" ? "Concluída" : fmtDue(t.due)}</span>
                      <ChevronRight size={16} className="text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{isCommission ? "Nenhum próximo passo atribuído." : "Nenhuma tarefa para você nesta reunião."}</p>
            )}
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {needsAck && <AckCard meetingId={meeting.id} ackAt={myAck?.at} />}
          {visibleRecordings(data, me)
            .filter((r) => r.meetingId === meeting.id)
            .map((r) => (
              <Link key={r.id} to={`/gravacoes/${r.id}`} className="card flex items-center gap-3 p-4 hover:border-line-2">
                <span className="grid size-10 place-items-center rounded-xl bg-accent/15 text-accent">
                  <PlayCircle {...ICON} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Assistir gravação</span>
                  <span className="block text-xs text-muted">
                    {fmtClock(r.durationSec)} · {plural(r.chapters.length, "capítulo", "capítulos")}
                  </span>
                </span>
                <ChevronRight size={16} className="text-muted" />
              </Link>
            ))}
          {isCommission && <AckPanel data={data} meeting={meeting} />}
          {isCommission && (
            <Card title="Presença" action={<span className="text-xs text-muted">{summary.attendance.length} de {meeting.invitedIds.length}</span>}>
              <ul className="space-y-1.5">
                {meeting.invitedIds.map((id) => (
                  <li key={id} className="flex items-center gap-2.5 text-sm">
                    <Avatar name={memberName(data, id)} size={26} muted={!summary.attendance.includes(id)} />
                    <span className={`flex-1 truncate ${summary.attendance.includes(id) ? "" : "text-muted"}`}>{memberName(data, id)}</span>
                    <span className="text-xs text-muted">{summary.attendance.includes(id) ? "Presente" : "Ausente"}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

function AckCard({ meetingId, ackAt }: { meetingId: string; ackAt?: string }) {
  const { busy, run } = useAction();
  if (ackAt) {
    return (
      <Card className="border-accent/40">
        <div className="flex items-center gap-3">
          <CheckCircle2 {...ICON} size={28} className="text-accent" />
          <div>
            <p className="font-bold">Ciência confirmada</p>
            <p className="text-xs text-muted">{fmtDateTime(ackAt)}</p>
          </div>
        </div>
      </Card>
    );
  }
  return (
    <Card className="border-warn/40">
      <p className="font-bold">Leu o resumo?</p>
      <p className="mt-1 mb-4 text-sm text-muted">Confirme a ciência das decisões. A comissão vê quem confirmou a leitura.</p>
      <Button variant="primary" icon={Check} className="w-full" disabled={busy} onClick={() => run(() => api.acknowledge(meetingId))}>
        Estou ciente
      </Button>
    </Card>
  );
}

function AckPanel({ data, meeting }: { data: Data; meeting: Meeting }) {
  const audience = ackAudience(meeting);
  const done = audience.filter((id) => ackOf(data, meeting.id, id));
  const pending = audience.filter((id) => !ackOf(data, meeting.id, id));
  const [reminded, setReminded] = useState<number | null>(null);

  return (
    <Card title="Ciência do time" action={<Badge tone={pending.length ? "muted" : "accent"}>{`${done.length} de ${audience.length}`}</Badge>}>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-accent" style={{ width: `${audience.length ? (done.length / audience.length) * 100 : 100}%` }} />
      </div>
      {audience.length === 0 ? (
        <p className="text-sm text-muted">Ninguém além de você foi convidado.</p>
      ) : (
        <ul className="space-y-2">
          {[...done, ...pending].map((id) => {
            const ack = ackOf(data, meeting.id, id);
            return (
              <li key={id} className="flex items-center gap-2.5 text-sm">
                <Avatar name={memberName(data, id)} size={28} muted={!ack} />
                <span className="flex-1 truncate">{memberName(data, id)}</span>
                {ack ? <Badge tone="accent">Ciente {fmtTime(ack.at)}</Badge> : <Badge tone="warn">Pendente</Badge>}
              </li>
            );
          })}
        </ul>
      )}
      {pending.length > 0 && (
        <Button
          icon={BellRing}
          className="mt-4 w-full"
          onClick={async () => {
            setReminded(await api.remindPending(meeting.id));
          }}
        >
          Lembrar {plural(pending.length, "pendente", "pendentes")}
        </Button>
      )}
      {reminded !== null && <p className="mt-2 text-center text-xs text-muted">Lembrete enviado no app para {plural(reminded, "pessoa", "pessoas")}.</p>}
    </Card>
  );
}
