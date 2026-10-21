import { FormEvent, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CalendarCheck, CalendarDays, CalendarX, Clock, ExternalLink, FileText, ListChecks, Plus, Radio, Send, Trash2, Type, Users, Video, X, Zap } from "lucide-react";
import { MeetingRow } from "../components/MeetingRow";
import { Avatar, Badge, Button, Card, CheckRow, Empty, ErrorText, Field, ICON, PageHeader, Segmented, Toggle, useAction } from "../components/ui";
import { fmtDateTime, fmtRange, plural, toLocalInput } from "../lib/format";
import { go } from "../lib/router";
import { audienceLabel, isUpcoming, memberName, rsvpOf, statusLabel, teamMembers, visibleMeetings } from "../lib/selectors";
import { api, resolveInvited } from "../lib/store";
import type { AgendaItem, Audience, Data, Meeting, Member, Team } from "../lib/types";

const TITLE_MAX = 100;

// ---------------- Lista ----------------

export function MeetingsList({ data, me }: { data: Data; me: Member }) {
  const [tab, setTab] = useState<"next" | "past">("next");
  const meetings = visibleMeetings(data, me);
  const list = tab === "next" ? meetings.filter(isUpcoming) : meetings.filter((m) => !isUpcoming(m)).reverse();

  return (
    <>
      <PageHeader
        title={me.role === "commission" ? "Reuniões" : "Suas reuniões"}
        subtitle={me.role === "commission" ? "Todas as reuniões do time." : "Só os encontros para os quais você foi convidado."}
        actions={
          me.role === "commission" && (
            <Button variant="primary" icon={Plus} onClick={() => go("/reunioes/nova")}>
              Nova reunião
            </Button>
          )
        }
      />
      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "next", label: "Próximas" },
            { value: "past", label: "Anteriores" },
          ]}
        />
      </div>
      <Card padded={false} className="p-2">
        {list.length ? (
          list.map((m) => <MeetingRow key={m.id} data={data} meeting={m} me={me} />)
        ) : (
          <Empty
            icon={CalendarDays}
            title={tab === "next" ? "Sem reuniões por aqui" : "Nenhuma reunião anterior"}
            text={
              tab === "next"
                ? me.role === "commission"
                  ? "Crie uma reunião e escolha quem participa."
                  : "Você ainda não tem reuniões futuras. Quando a comissão convidar você, o encontro aparece aqui."
                : "As reuniões encerradas e seus resumos aparecem aqui."
            }
            action={me.role === "commission" && tab === "next" ? <Button variant="primary" icon={Plus} onClick={() => go("/reunioes/nova")}>Nova reunião</Button> : undefined}
          />
        )}
      </Card>
    </>
  );
}

// ---------------- Nova reunião ----------------

function nextHour() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return toLocalInput(d);
}

const newItem = (): AgendaItem => ({ id: crypto.randomUUID(), title: "", minutes: 5 });

export function NewMeeting({ data, me, team }: { data: Data; me: Member; team: Team }) {
  const members = teamMembers(data, team.id);
  const [title, setTitle] = useState("");
  const [opponent, setOpponent] = useState("");
  const [audience, setAudience] = useState<Audience>({ kind: "all", groups: [], memberIds: [] });
  const [when, setWhen] = useState<"now" | "schedule">("schedule");
  const [startsAt, setStartsAt] = useState(nextHour);
  const [duration, setDuration] = useState<30 | 45 | 60>(45);
  const [agenda, setAgenda] = useState<AgendaItem[]>([newItem()]);
  const [record, setRecord] = useState(true);
  const { busy, error, setError, run } = useAction();

  const invitedIds = useMemo(() => resolveInvited(data, team.id, audience, me.id), [data, team.id, audience, me.id]);
  const agendaMinutes = agenda.reduce((n, i) => n + (i.title.trim() ? i.minutes : 0), 0);

  const setItem = (id: string, patch: Partial<AgendaItem>) => setAgenda((items) => items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const moveItem = (index: number, delta: number) =>
    setAgenda((items) => {
      const next = [...items];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Escreva o tema da reunião.");
    if (audience.kind === "groups" && !audience.groups.length) return setError("Escolha pelo menos um grupo.");
    if (audience.kind === "members" && !audience.memberIds.length) return setError("Escolha pelo menos uma pessoa.");
    let created: Meeting | undefined;
    const ok = await run(async () => {
      created = await api.createMeeting({
        title,
        opponent,
        audience,
        agenda,
        startsAt: new Date(startsAt).toISOString(),
        duration,
        record,
        callUrl: "",
        startNow: when === "now",
      });
    });
    if (ok && created) go(when === "now" ? `/reunioes/${created.id}/sala` : `/reunioes/${created.id}`);
  }

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  return (
    <form onSubmit={submit}>
      <PageHeader back="/reunioes" title="Nova reunião" subtitle="Só quem for convidado recebe o aviso no app." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card title="1 · Tema da reunião">
            <div className="flex items-center gap-2.5 rounded-xl border border-line-2 bg-surface-2 pr-3.5 focus-within:border-accent">
              <Type {...ICON} className="ml-3.5 shrink-0 text-muted" />
              <input
                className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-muted/70"
                autoFocus
                value={title}
                maxLength={TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Escreva o tema da reunião"
              />
              <span className="shrink-0 text-xs text-muted tabular-nums">
                {title.length}/{TITLE_MAX}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted">Texto livre, como o título de um vídeo. Os convidados veem este tema no convite, na sala e no resumo.</p>
          </Card>

          <Card title="2 · Para quem é" action={<span className="text-xs text-muted">{plural(invitedIds.length, "convidado", "convidados")}</span>}>
            <Segmented
              value={audience.kind}
              onChange={(kind) => setAudience({ ...audience, kind })}
              options={[
                { value: "all", label: "Time todo" },
                { value: "commission", label: "Comissão técnica" },
                { value: "groups", label: "Grupos" },
                { value: "members", label: "Pessoas" },
              ]}
            />
            {audience.kind === "groups" && (
              <div className="mt-4">
                {team.groups.length ? (
                  <div className="flex flex-wrap gap-2">
                    {team.groups.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setAudience({ ...audience, groups: toggle(audience.groups, g) })}
                        className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold ${audience.groups.includes(g) ? "border-accent bg-accent/15 text-ink" : "border-line-2 text-muted hover:text-ink"}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    Seu time ainda não tem grupos.{" "}
                    <a href="#/time" className="font-semibold text-accent hover:underline">
                      Criar grupos
                    </a>
                  </p>
                )}
              </div>
            )}
            {audience.kind === "members" && (
              <div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-line p-1">
                {members.filter((m) => m.id !== me.id).length ? (
                  members
                    .filter((m) => m.id !== me.id)
                    .map((m) => (
                      <CheckRow key={m.id} checked={audience.memberIds.includes(m.id)} onChange={() => setAudience({ ...audience, memberIds: toggle(audience.memberIds, m.id) })}>
                        <span className="text-sm font-medium">{m.name}</span>
                        <span className="ml-2 text-xs text-muted">{[m.title, m.position].filter(Boolean).join(" · ")}</span>
                      </CheckRow>
                    ))
                ) : (
                  <p className="p-3 text-sm text-muted">Cadastre pessoas no elenco para escolher aqui.</p>
                )}
              </div>
            )}
            {members.length <= 1 && audience.kind !== "members" && (
              <p className="mt-3 text-xs text-warn">Seu elenco ainda está vazio: por enquanto só você será convidado.</p>
            )}
          </Card>

          <Card title="3 · Detalhes">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Quando">
                <Segmented
                  value={when}
                  onChange={setWhen}
                  options={[
                    { value: "now", label: <span className="inline-flex items-center gap-1.5"><Zap size={14} />Agora</span> },
                    { value: "schedule", label: <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />Agendar</span> },
                  ]}
                />
              </Field>
              <Field label="Data e horário">
                <input className="input" type="datetime-local" disabled={when === "now"} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required={when === "schedule"} />
              </Field>
              <Field label="Duração">
                <Segmented
                  value={String(duration) as "30" | "45" | "60"}
                  onChange={(v) => setDuration(Number(v) as 30 | 45 | 60)}
                  options={[
                    { value: "30", label: "30 min" },
                    { value: "45", label: "45 min" },
                    { value: "60", label: "60 min" },
                  ]}
                />
              </Field>
              <Field label="Adversário (opcional)">
                <input className="input" value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="Nome do adversário" />
              </Field>
            </div>
          </Card>

          <Card
            title="4 · Pauta"
            action={
              <span className={`text-xs ${agendaMinutes > duration ? "text-warn" : "text-muted"}`}>
                {agendaMinutes} de {duration} min
              </span>
            }
          >
            <div className="space-y-2">
              {agenda.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-muted">{index + 1}</span>
                  <input className="input" value={item.title} onChange={(e) => setItem(item.id, { title: e.target.value })} placeholder="Item da pauta" />
                  <div className="flex shrink-0 items-center rounded-xl border border-line-2 bg-surface-2 pr-2.5">
                    <input
                      className="h-11 w-12 bg-transparent text-right text-sm outline-none"
                      type="number"
                      min={1}
                      max={60}
                      value={item.minutes}
                      onChange={(e) => setItem(item.id, { minutes: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })}
                    />
                    <span className="ml-1 text-xs text-muted">min</span>
                  </div>
                  <div className="hidden shrink-0 sm:flex">
                    <button type="button" disabled={index === 0} onClick={() => moveItem(index, -1)} className="grid size-9 place-items-center rounded-lg text-muted hover:text-ink disabled:opacity-30" title="Subir">
                      <ArrowUp size={16} />
                    </button>
                    <button type="button" disabled={index === agenda.length - 1} onClick={() => moveItem(index, 1)} className="grid size-9 place-items-center rounded-lg text-muted hover:text-ink disabled:opacity-30" title="Descer">
                      <ArrowDown size={16} />
                    </button>
                  </div>
                  <button type="button" onClick={() => setAgenda((items) => items.filter((i) => i.id !== item.id))} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:text-danger" title="Remover">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <Button small icon={Plus} className="mt-3" onClick={() => setAgenda((items) => [...items, newItem()])}>
              Adicionar item
            </Button>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <p className="eyebrow mb-2">Prévia</p>
            <p className="display text-xl leading-tight break-words">{title.trim() || "Tema da reunião"}</p>
            <div className="mt-3 space-y-1.5 text-sm text-muted">
              <p className="flex items-center gap-2"><Clock size={15} />{when === "now" ? "Agora" : fmtDateTime(new Date(startsAt).toISOString())} · {duration} min</p>
              <p className="flex items-center gap-2"><Users size={15} />{plural(invitedIds.length, "convidado", "convidados")}</p>
              <p className="flex items-center gap-2"><ListChecks size={15} />{plural(agenda.filter((i) => i.title.trim()).length, "item", "itens")} na pauta</p>
            </div>
            <div className="mt-4 border-t border-line pt-3">
              <Toggle checked={record} onChange={setRecord} label="Gravar reunião" hint="Mostra o aviso aos convidados e libera o botão Gravar na sala." />
            </div>
          </Card>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" variant="primary" icon={when === "now" ? Video : Send} className="w-full" disabled={busy}>
            {when === "now" ? "Iniciar reunião agora" : "Agendar e convidar"}
          </Button>
        </aside>
      </div>
    </form>
  );
}

// ---------------- Detalhe ----------------

export function MeetingDetail({ data, me, meeting }: { data: Data; me: Member; meeting: Meeting }) {
  const isCommission = me.role === "commission";
  const myRsvp = rsvpOf(data, meeting.id, me.id);
  const invited = meeting.invitedIds.filter((id) => id !== meeting.createdBy);
  const going = invited.filter((id) => rsvpOf(data, meeting.id, id)?.going === true);
  const notGoing = invited.filter((id) => rsvpOf(data, meeting.id, id)?.going === false);
  const noAnswer = invited.filter((id) => !rsvpOf(data, meeting.id, id));
  const { busy, run } = useAction();

  const primary = () => {
    if (meeting.status === "live")
      return (
        <Button variant="primary" icon={Video} onClick={() => go(`/reunioes/${meeting.id}/sala`)}>
          Entrar na sala
        </Button>
      );
    if (meeting.status === "published")
      return (
        <Button variant="primary" icon={FileText} onClick={() => go(`/reunioes/${meeting.id}/resumo`)}>
          {isCommission ? "Ver resumo" : "Ler resumo"}
        </Button>
      );
    if (meeting.status === "ended" && isCommission)
      return (
        <Button variant="primary" icon={Send} onClick={() => go(`/reunioes/${meeting.id}/encerrar`)}>
          Publicar resumo
        </Button>
      );
    if (meeting.status === "scheduled" && isCommission)
      return (
        <Button variant="primary" icon={Radio} disabled={busy} onClick={async () => { if (await run(() => api.startMeeting(meeting.id))) go(`/reunioes/${meeting.id}/sala`); }}>
          Iniciar reunião
        </Button>
      );
    return null;
  };

  return (
    <>
      <PageHeader
        back="/reunioes"
        eyebrow={statusLabel(meeting)}
        title={meeting.title}
        subtitle={`${fmtRange(meeting.startsAt, meeting.duration)} · ${audienceLabel(meeting)}`}
        actions={primary()}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {!isCommission && meeting.status === "scheduled" && (
            <Card title="Sua resposta">
              <div className="flex flex-wrap gap-2">
                <Button variant={myRsvp?.going ? "primary" : "secondary"} icon={CalendarCheck} onClick={() => api.rsvp(meeting.id, true)}>
                  Vou participar
                </Button>
                <Button variant={myRsvp && !myRsvp.going ? "primary" : "secondary"} icon={CalendarX} onClick={() => api.rsvp(meeting.id, false)}>
                  Não vou participar
                </Button>
              </div>
              {myRsvp && (
                <p className="mt-3 text-sm text-muted">
                  {myRsvp.going
                    ? "Presença confirmada. O time já sabe da sua resposta. Você pode mudar até a reunião começar."
                    : "Ausência informada. O resumo fica disponível para você depois que a comissão publicar."}
                </p>
              )}
            </Card>
          )}

          <Card title="Pauta">
            {meeting.agenda.length ? (
              <ol className="space-y-2">
                {meeting.agenda.map((item, i) => (
                  <li key={item.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-3">
                    <span className="grid size-6 place-items-center rounded-md bg-accent/15 text-xs font-bold text-accent">{i + 1}</span>
                    <span className="flex-1 text-sm">{item.title}</span>
                    <Badge>{item.minutes} min</Badge>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">Sem pauta definida.</p>
            )}
          </Card>

          <Card title="Detalhes">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Conduzida por</dt>
                <dd className="mt-1 font-medium">{memberName(data, meeting.createdBy)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Público</dt>
                <dd className="mt-1 font-medium">{audienceLabel(meeting)}</dd>
              </div>
              {meeting.opponent && (
                <div>
                  <dt className="text-xs text-muted">Adversário</dt>
                  <dd className="mt-1 font-medium">{meeting.opponent}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted">Gravação</dt>
                <dd className="mt-1 font-medium">{meeting.record ? "Esta reunião será gravada" : "Sem gravação"}</dd>
              </div>
              {meeting.callUrl && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted">Chamada de vídeo</dt>
                  <dd className="mt-1">
                    <a href={meeting.callUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline">
                      Abrir link <ExternalLink size={14} />
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Presença" action={<span className="text-xs text-muted">{going.length} de {invited.length} confirmados</span>}>
            {invited.length === 0 ? (
              <p className="text-sm text-muted">Nenhum outro convidado.</p>
            ) : (
              <div className="space-y-4">
                {[
                  ["Vão participar", going, "accent"],
                  ["Não vão", notGoing, "muted"],
                  ["Sem resposta", noAnswer, "warn"],
                ].map(([label, ids, tone]) =>
                  (ids as string[]).length ? (
                    <div key={label as string}>
                      <p className="eyebrow mb-2">
                        {label as string} · {(ids as string[]).length}
                      </p>
                      <ul className="space-y-1.5">
                        {(ids as string[]).map((id) => (
                          <li key={id} className="flex items-center gap-2.5 text-sm">
                            <Avatar name={memberName(data, id)} size={28} muted={tone !== "accent"} />
                            <span className="truncate">{memberName(data, id)}</span>
                            {id === me.id && <span className="text-xs text-muted">(você)</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </Card>
          {isCommission && meeting.status === "scheduled" && (
            <Button
              variant="danger"
              icon={Trash2}
              className="w-full"
              onClick={async () => {
                if (confirm("Excluir esta reunião? Os convidados deixam de vê-la.")) {
                  await api.deleteMeeting(meeting.id);
                  go("/reunioes");
                }
              }}
            >
              Excluir reunião
            </Button>
          )}
        </aside>
      </div>
    </>
  );
}
