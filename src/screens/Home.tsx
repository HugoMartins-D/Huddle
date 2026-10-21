import { ReactNode } from "react";
import { CalendarCheck, CalendarDays, CheckSquare, ChevronRight, FileText, Plus, Radio, UserPlus, Users, Video } from "lucide-react";
import { MeetingRow, MeetingStatusBadge, meetingRoute } from "../components/MeetingRow";
import { Badge, Button, Card, Empty, ICON } from "../components/ui";
import { firstName, fmtDay, fmtDue, fmtRange, isOverdue } from "../lib/format";
import { Link, go } from "../lib/router";
import { ackAudience, ackOf, athletePending, audienceLabel, isUpcoming, rsvpOf, teamMembers, visibleMeetings } from "../lib/selectors";
import { api } from "../lib/store";
import type { Data, Meeting, Member, Team } from "../lib/types";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="card p-4">
      <p className="eyebrow">{label}</p>
      <p className="display mt-2 text-3xl">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

function NextMeetingHero({ data, meeting, me, actions }: { data: Data; meeting: Meeting; me: Member; actions: ReactNode }) {
  return (
    <section className="card relative overflow-hidden p-6 md:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,color-mix(in_oklab,var(--accent)_22%,transparent),transparent_55%)]" />
      <div className="relative">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone="accent">{meeting.status === "live" ? "Acontecendo agora" : "Próxima reunião"}</Badge>
          <MeetingStatusBadge data={data} meeting={meeting} me={me} />
        </div>
        <h2 className="display text-3xl leading-tight md:text-4xl">{meeting.title}</h2>
        <p className="mt-2 text-sm text-muted">
          {fmtRange(meeting.startsAt, meeting.duration)} · {audienceLabel(meeting)}
          {meeting.agenda.length > 0 && ` · ${meeting.agenda.length} ${meeting.agenda.length === 1 ? "item" : "itens"} na pauta`}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">{actions}</div>
      </div>
    </section>
  );
}

// ---------------- Comissão ----------------

export function CommissionHome({ data, me, team }: { data: Data; me: Member; team: Team }) {
  const meetings = visibleMeetings(data, me);
  const upcoming = meetings.filter(isUpcoming);
  const next = upcoming.find((m) => m.status === "live") ?? upcoming[0];
  const toPublish = meetings.filter((m) => m.status === "ended");
  const published = meetings.filter((m) => m.status === "published").reverse();
  const members = teamMembers(data, team.id);
  const pendingAcks = published.reduce((n, m) => n + ackAudience(m).filter((id) => !ackOf(data, m.id, id)).length, 0);
  const openTasks = data.tasks.filter((t) => t.teamId === team.id && t.status === "pending").length;
  const pendingInvites = members.filter((m) => m.status === "invited").length;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1.5">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="display text-3xl">
            {greeting()}, {firstName(me.name)}
          </h1>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => go("/reunioes/nova")}>
          Nova reunião
        </Button>
      </div>

      {members.length <= 1 && (
        <Card className="mb-6 border-accent/40">
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid size-11 place-items-center rounded-xl bg-accent/15 text-accent">
              <Users {...ICON} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold">Monte seu elenco</p>
              <p className="text-sm text-muted">Cadastre a comissão e os atletas. Cada pessoa recebe um link de convite para criar a senha.</p>
            </div>
            <Button variant="primary" icon={UserPlus} onClick={() => go("/elenco/novo")}>
              Cadastrar pessoa
            </Button>
          </div>
        </Card>
      )}

      {next ? (
        <NextMeetingHero
          data={data}
          meeting={next}
          me={me}
          actions={
            next.status === "live" ? (
              <Button variant="primary" icon={Video} onClick={() => go(`/reunioes/${next.id}/sala`)}>
                Entrar na sala
              </Button>
            ) : (
              <>
                <Button variant="primary" icon={Radio} onClick={async () => { await api.startMeeting(next.id); go(`/reunioes/${next.id}/sala`); }}>
                  Iniciar reunião
                </Button>
                <Button onClick={() => go(`/reunioes/${next.id}`)}>Ver detalhes</Button>
              </>
            )
          }
        />
      ) : (
        <Card>
          <Empty icon={CalendarDays} title="Nenhuma reunião marcada" text="Crie uma reunião para alinhar o time. Só quem for convidado recebe o aviso." action={<Button variant="primary" icon={Plus} onClick={() => go("/reunioes/nova")}>Nova reunião</Button>} />
        </Card>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Agendadas" value={upcoming.length} hint="reuniões futuras ou ao vivo" />
        <Stat label="Ciência pendente" value={pendingAcks} hint="leituras de resumo em aberto" />
        <Stat label="Tarefas abertas" value={openTasks} hint="próximos passos do time" />
        <Stat label="Convites" value={pendingInvites} hint="aguardando ativação" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Próximas reuniões" action={<Link to="/reunioes" className="text-sm text-muted hover:text-ink">Ver todas</Link>} padded={false} className="pb-2">
          {upcoming.length ? (
            <div className="px-2">{upcoming.slice(0, 5).map((m) => <MeetingRow key={m.id} data={data} meeting={m} me={me} />)}</div>
          ) : (
            <p className="px-5 pb-4 text-sm text-muted">Nada agendado.</p>
          )}
        </Card>
        <Card title="Resumos" padded={false} className="pb-2">
          {toPublish.length + published.length ? (
            <div className="px-2">{[...toPublish, ...published].slice(0, 5).map((m) => <MeetingRow key={m.id} data={data} meeting={m} me={me} />)}</div>
          ) : (
            <p className="px-5 pb-4 text-sm text-muted">Os resumos publicados aparecem aqui, com quem já confirmou a leitura.</p>
          )}
        </Card>
      </div>
    </>
  );
}

// ---------------- Atleta ----------------

function PendingItem({ to, icon: Icon, eyebrow, title, text, tone = "accent" }: { to: string; icon: typeof FileText; eyebrow: string; title: string; text: string; tone?: "accent" | "warn" | "danger" }) {
  const toneClass = tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-accent";
  return (
    <Link to={to} className="group card flex items-center gap-4 p-4 transition-colors hover:border-line-2">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl bg-surface-3 ${toneClass}`}>
        <Icon {...ICON} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[11px] font-bold tracking-wide uppercase ${toneClass}`}>{eyebrow}</span>
        <span className="block truncate font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted">{text}</span>
      </span>
      <ChevronRight {...ICON} size={16} className="text-muted group-hover:text-ink" />
    </Link>
  );
}

export function AthleteHome({ data, me }: { data: Data; me: Member }) {
  const meetings = visibleMeetings(data, me);
  const upcoming = meetings.filter(isUpcoming);
  const next = upcoming.find((m) => m.status === "live") ?? upcoming[0];
  const pending = athletePending(data, me);
  const rsvp = next ? rsvpOf(data, next.id, me.id) : undefined;
  const rsvpList = pending.rsvp.filter((m) => m.id !== next?.id);
  const total = rsvpList.length + pending.summaries.length + pending.tasks.length;

  return (
    <>
      <div className="mb-6">
        <p className="eyebrow mb-1.5">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="display text-3xl">
          {greeting()}, {firstName(me.name)}
        </h1>
      </div>

      {next ? (
        <NextMeetingHero
          data={data}
          meeting={next}
          me={me}
          actions={
            next.status === "live" ? (
              <Button variant="primary" icon={Video} onClick={() => go(`/reunioes/${next.id}/sala`)}>
                Entrar na reunião
              </Button>
            ) : (
              <>
                <Button variant={rsvp?.going ? "primary" : "secondary"} icon={CalendarCheck} onClick={() => api.rsvp(next.id, true)}>
                  Vou participar
                </Button>
                <Button variant={rsvp && !rsvp.going ? "primary" : "secondary"} onClick={() => api.rsvp(next.id, false)}>
                  Não vou
                </Button>
                <Button variant="ghost" onClick={() => go(`/reunioes/${next.id}`)}>
                  Detalhes
                </Button>
              </>
            )
          }
        />
      ) : (
        <Card>
          <Empty icon={CalendarDays} title="Nenhuma reunião marcada" text="Quando a comissão convidar você, a reunião aparece aqui." />
        </Card>
      )}

      <h2 className="mt-8 mb-3 text-[15px] font-bold">Suas pendências</h2>
      {total === 0 ? (
        <Card>
          {next && next.status === "scheduled" && !rsvp ? (
            <Empty icon={CheckSquare} title="Nenhuma outra pendência" text="Só falta responder a presença da próxima reunião." />
          ) : (
            <Empty icon={CheckSquare} title="Sua agenda está em dia" text="Sem presenças para responder, resumos para ler ou tarefas abertas." />
          )}
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rsvpList.map((m) => (
            <PendingItem key={m.id} to={`/reunioes/${m.id}`} icon={CalendarCheck} eyebrow="Responder presença" title={m.title} text={fmtRange(m.startsAt, m.duration)} tone="warn" />
          ))}
          {pending.summaries.map((m) => (
            <PendingItem key={m.id} to={meetingRoute(m, me)} icon={FileText} eyebrow="Resumo para ler" title={m.title} text="Confirme a ciência das decisões publicadas para você." />
          ))}
          {pending.tasks.map((t) => (
            <PendingItem key={t.id} to={`/tarefas/${t.id}`} icon={CheckSquare} eyebrow={`Tarefa · ${fmtDue(t.due)}`} title={t.title} text={data.meetings.find((m) => m.id === t.meetingId)?.title ?? ""} tone={isOverdue(t.due) ? "danger" : "accent"} />
          ))}
        </div>
      )}
    </>
  );
}
