import { FormEvent, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Circle, DoorOpen, FileText, LogIn, MessageSquare, NotebookPen, Radio, Send, Square, Users, Video } from "lucide-react";
import { VideoStage } from "../components/VideoStage";
import { Avatar, Badge, Button, Card, Empty, ErrorText, PageHeader, Toggle, useAction } from "../components/ui";
import { fmtClock, fmtRange, fmtTime } from "../lib/format";
import { useRecorder } from "../lib/recorder";
import { go } from "../lib/router";
import { memberName } from "../lib/selectors";
import { api } from "../lib/store";
import type { Data, Meeting, Member } from "../lib/types";

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function LiveRoom({ data, me, meeting }: { data: Data; me: Member; meeting: Meeting }) {
  const isCommission = me.role === "commission";
  const [entered, setEntered] = useState(false);
  const [withCamera, setWithCamera] = useState(true);
  const [withMic, setWithMic] = useState(true);
  const { busy, run } = useAction();

  if (meeting.status === "scheduled") {
    return (
      <>
        <PageHeader back={`/reunioes/${meeting.id}`} title={meeting.title} subtitle={fmtRange(meeting.startsAt, meeting.duration)} />
        <Card>
          <Empty
            icon={Video}
            title="A reunião ainda não começou"
            text={isCommission ? "Inicie quando o time estiver pronto. Os convidados recebem um aviso no app." : "Você recebe um aviso no app quando a comissão iniciar."}
            action={
              isCommission && (
                <Button variant="primary" icon={Radio} disabled={busy} onClick={() => run(() => api.startMeeting(meeting.id))}>
                  Iniciar reunião
                </Button>
              )
            }
          />
        </Card>
      </>
    );
  }

  if (meeting.status === "ended" || meeting.status === "published") {
    return (
      <>
        <PageHeader back="/reunioes" title={meeting.title} />
        <Card>
          <Empty
            icon={DoorOpen}
            title="Reunião encerrada"
            text={meeting.status === "published" ? "O resumo já foi publicado." : isCommission ? "Publique o resumo com as decisões e os próximos passos." : "O resumo aparece aqui quando a comissão publicar."}
            action={
              meeting.status === "published" ? (
                <Button variant="primary" icon={FileText} onClick={() => go(`/reunioes/${meeting.id}/resumo`)}>
                  {isCommission ? "Ver resumo" : "Ler resumo"}
                </Button>
              ) : isCommission ? (
                <Button variant="primary" icon={Send} onClick={() => go(`/reunioes/${meeting.id}/encerrar`)}>
                  Encerrar e publicar
                </Button>
              ) : (
                <Button onClick={() => go("/inicio")}>Voltar ao início</Button>
              )
            }
          />
        </Card>
      </>
    );
  }

  if (!entered) {
    return (
      <>
        <PageHeader back={`/reunioes/${meeting.id}`} eyebrow="Antes de entrar" title={meeting.title} subtitle={`${meeting.joinedIds.length} na sala agora`} />
        <div className="mx-auto max-w-lg">
          <Card>
            <div className="flex items-center gap-3">
              <Avatar name={me.name} size={48} />
              <div>
                <p className="font-semibold">{me.name}</p>
                <p className="text-sm text-muted">Você entra como {me.title.toLowerCase()}.</p>
              </div>
            </div>
            <div className="mt-4 divide-y divide-line border-y border-line">
              <Toggle checked={withCamera} onChange={setWithCamera} label="Câmera ligada" />
              <Toggle checked={withMic} onChange={setWithMic} label="Microfone ligado" />
            </div>
            <p className="mt-3 text-xs text-muted">O navegador vai pedir permissão para usar câmera e microfone. Dá para mudar dentro da sala.</p>
            {meeting.record && (
              <p className="mt-4 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm">
                <Circle size={10} className="fill-danger text-danger" /> Esta reunião está sendo gravada.
              </p>
            )}
            <Button
              variant="primary"
              icon={LogIn}
              className="mt-5 w-full"
              disabled={busy}
              onClick={async () => {
                if (await run(() => api.joinMeeting(meeting.id))) setEntered(true);
              }}
            >
              Entrar na sala
            </Button>
          </Card>
        </div>
      </>
    );
  }

  return <Room data={data} me={me} meeting={meeting} withCamera={withCamera} withMic={withMic} />;
}

function Room({ data, me, meeting, withCamera, withMic }: { data: Data; me: Member; meeting: Meeting; withCamera: boolean; withMic: boolean }) {
  const isCommission = me.role === "commission";
  const now = useNow();
  const [tab, setTab] = useState<"chat" | "people" | "notes">("chat");
  const { busy, run } = useAction();
  const recorder = useRecorder(meeting);

  const elapsed = meeting.startedAt ? (now - new Date(meeting.startedAt).getTime()) / 1000 : 0;
  const item = meeting.agenda[meeting.currentItem];
  const itemElapsed = meeting.itemStartedAt ? (now - new Date(meeting.itemStartedAt).getTime()) / 1000 : 0;
  const itemRemaining = item ? item.minutes * 60 - itemElapsed : 0;
  const progress = item ? Math.min(1, itemElapsed / (item.minutes * 60)) : 0;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Badge tone="live">● Ao vivo</Badge>
            {recorder.state === "recording" ? (
              <Badge tone="danger">● REC {fmtClock((now - recorder.startedAt) / 1000)}</Badge>
            ) : (
              meeting.record && <Badge tone="danger">Esta reunião está sendo gravada</Badge>
            )}
            <span className="text-xs text-muted tabular-nums">{fmtClock(elapsed)}</span>
            <span className="text-xs text-muted">
              {meeting.joinedIds.length} na sala · conduzida por {memberName(data, meeting.createdBy)}
            </span>
          </div>
          <h1 className="display truncate text-2xl md:text-3xl">{meeting.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {isCommission && meeting.record && (
            recorder.state === "recording" ? (
              <Button icon={Square} onClick={() => recorder.stop()}>
                Parar gravação
              </Button>
            ) : (
              <Button icon={Circle} disabled={recorder.state !== "idle"} onClick={() => recorder.start()}>
                {recorder.state === "saving" ? "Salvando gravação…" : recorder.state === "starting" ? "Escolha a aba…" : "Gravar"}
              </Button>
            )
          )}
          {isCommission ? (
            <Button
              variant="danger"
              icon={Square}
              disabled={busy || recorder.state === "saving"}
              onClick={async () => {
                if (!confirm("Encerrar a reunião para todos?")) return;
                await recorder.stop();
                if (await run(() => api.endMeeting(meeting.id))) go(`/reunioes/${meeting.id}/encerrar`);
              }}
            >
              Encerrar reunião
            </Button>
          ) : (
            <Button icon={DoorOpen} onClick={() => go("/inicio")}>
              Sair da sala
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {recorder.error && <ErrorText>{recorder.error}</ErrorText>}
          <section className="card h-[min(62vh,560px)] min-h-[340px] w-full overflow-hidden">
            <VideoStage meeting={meeting} me={me} withCamera={withCamera} withMic={withMic} />
          </section>

          <Card title="Pauta" action={meeting.agenda.length > 0 && <span className="text-xs text-muted">Item {meeting.currentItem + 1} de {meeting.agenda.length}</span>}>
            {item ? (
              <>
                <div className="rounded-xl border border-accent/40 bg-accent/10 p-4">
                  <p className="eyebrow text-accent">Em discussão</p>
                  <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
                    <p className="text-lg font-bold">{item.title}</p>
                    <p className={`display text-2xl tabular-nums ${itemRemaining < 0 ? "text-warn" : ""}`}>
                      {itemRemaining < 0 ? `+${fmtClock(-itemRemaining)}` : fmtClock(itemRemaining)}
                    </p>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className={`h-full rounded-full ${itemRemaining < 0 ? "bg-warn" : "bg-accent"}`} style={{ width: `${progress * 100}%` }} />
                  </div>
                </div>
                <ol className="mt-3 space-y-1">
                  {meeting.agenda.map((a, i) => (
                    <li key={a.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${i === meeting.currentItem ? "text-ink" : i < meeting.currentItem ? "text-muted line-through" : "text-muted"}`}>
                      <span className="w-4 text-xs font-bold">{i + 1}</span>
                      <span className="flex-1">{a.title}</span>
                      <span className="text-xs">{a.minutes} min</span>
                    </li>
                  ))}
                </ol>
                {isCommission && (
                  <div className="mt-3 flex gap-2">
                    <Button small icon={ChevronLeft} disabled={meeting.currentItem === 0} onClick={() => api.setAgendaItem(meeting.id, meeting.currentItem - 1)}>
                      Anterior
                    </Button>
                    <Button small variant="primary" disabled={meeting.currentItem >= meeting.agenda.length - 1} onClick={() => api.setAgendaItem(meeting.id, meeting.currentItem + 1)}>
                      Próximo item <ChevronRight size={16} />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">Esta reunião não tem pauta.</p>
            )}
          </Card>
        </div>

        <section className="card flex h-[620px] flex-col overflow-hidden lg:sticky lg:top-24">
          <div className="flex border-b border-line">
            {[
              ["chat", "Chat", MessageSquare],
              ["people", `Pessoas · ${meeting.joinedIds.length}`, Users],
              ...(isCommission ? [["notes", "Notas", NotebookPen]] : []),
            ].map(([key, label, Icon]) => {
              const I = Icon as typeof Users;
              return (
                <button
                  key={key as string}
                  type="button"
                  onClick={() => setTab(key as typeof tab)}
                  className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3.5 text-sm font-semibold ${tab === key ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}
                >
                  <I size={16} /> {label as string}
                </button>
              );
            })}
          </div>
          {tab === "chat" && <Chat data={data} me={me} meeting={meeting} />}
          {tab === "people" && <People data={data} meeting={meeting} />}
          {tab === "notes" && isCommission && <Notes meeting={meeting} />}
        </section>
      </div>
    </>
  );
}

function Chat({ data, me, meeting }: { data: Data; me: Member; meeting: Meeting }) {
  const [text, setText] = useState("");
  const messages = data.chat.filter((c) => c.meetingId === meeting.id);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    await api.sendChat(meeting.id, text);
    setText("");
  }

  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <p className="pt-8 text-center text-sm text-muted">Mensagens para todos na sala aparecem aqui.</p>}
        {messages.map((m) => {
          const mine = m.memberId === me.id;
          return (
            <div key={m.id} className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
              {!mine && <Avatar name={memberName(data, m.memberId)} size={28} />}
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${mine ? "bg-accent text-on-accent" : "bg-surface-3"}`}>
                {!mine && <p className="text-[11px] font-bold text-accent">{memberName(data, m.memberId)}</p>}
                <p className="text-sm break-words">{m.text}</p>
                <p className={`mt-0.5 text-[10px] ${mine ? "opacity-70" : "text-muted"}`}>{fmtTime(m.at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem para a sala" />
        <Button type="submit" variant="primary" icon={Send} disabled={!text.trim()} aria-label="Enviar" />
      </form>
    </>
  );
}

function People({ data, meeting }: { data: Data; meeting: Meeting }) {
  const notIn = meeting.invitedIds.filter((id) => !meeting.joinedIds.includes(id));
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="eyebrow mb-2">Na sala · {meeting.joinedIds.length}</p>
      <ul className="mb-5 space-y-2">
        {meeting.joinedIds.map((id) => (
          <li key={id} className="flex items-center gap-2.5 text-sm">
            <Avatar name={memberName(data, id)} size={30} />
            <span className="flex-1 truncate">{memberName(data, id)}</span>
            {id === meeting.createdBy && <Badge tone="accent">Condução</Badge>}
          </li>
        ))}
      </ul>
      {notIn.length > 0 && (
        <>
          <p className="eyebrow mb-2">Ainda não entraram · {notIn.length}</p>
          <ul className="space-y-2">
            {notIn.map((id) => (
              <li key={id} className="flex items-center gap-2.5 text-sm text-muted">
                <Avatar name={memberName(data, id)} size={30} muted />
                <span className="truncate">{memberName(data, id)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Notes({ meeting }: { meeting: Meeting }) {
  const [text, setText] = useState(meeting.notes);
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    if (text === meeting.notes) return;
    setSaved(false);
    const id = setTimeout(async () => {
      await api.saveNotes(meeting.id, text);
      setSaved(true);
    }, 600);
    return () => clearTimeout(id);
  }, [text, meeting.id, meeting.notes]);

  return (
    <div className="flex flex-1 flex-col p-4">
      <textarea
        className="input flex-1 resize-none"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Anotações da comissão. Só a comissão vê. Use para montar o resumo no encerramento."
      />
      <p className="mt-2 text-xs text-muted">{saved ? "Salvo" : "Salvando…"}</p>
    </div>
  );
}
