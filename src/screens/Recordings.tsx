import { FormEvent, useEffect, useRef, useState } from "react";
import { BookmarkPlus, Clapperboard, Download, Play as PlayIcon, Search, Trash2, X } from "lucide-react";
import { Badge, Button, Card, Empty, PageHeader, Segmented } from "../components/ui";
import { blobs } from "../lib/blobs";
import { fmtClock, fmtDateTime, plural } from "../lib/format";
import { Link, go } from "../lib/router";
import { memberName, visibleRecordings } from "../lib/selectors";
import { api } from "../lib/store";
import type { Data, Member, Recording } from "../lib/types";

const fmtSize = (bytes: number) => (bytes > 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`);

// ---------------- Lista ----------------

export function RecordingsList({ data, me }: { data: Data; me: Member }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const list = visibleRecordings(data, me).filter((r) => {
    if (!q) return true;
    const meeting = data.meetings.find((m) => m.id === r.meetingId);
    return [meeting?.title, ...r.chapters.map((c) => c.title), ...r.notes.map((n) => n.text)].join(" ").toLowerCase().includes(q);
  });

  return (
    <>
      <PageHeader
        title="Gravações"
        subtitle={me.role === "commission" ? "Gravações das reuniões, com capítulos e anotações da comissão." : "Gravações liberadas para você."}
      />
      <div className="relative mb-5 max-w-md">
        <Search size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
        <input className="input pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por título, capítulo ou anotação" />
      </div>
      {list.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => {
            const meeting = data.meetings.find((m) => m.id === r.meetingId);
            return (
              <Link key={r.id} to={`/gravacoes/${r.id}`} className="group card overflow-hidden transition-colors hover:border-line-2">
                <div className="relative grid aspect-video place-items-center bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--accent)_28%,transparent),transparent_60%)] bg-surface-3">
                  <span className="grid size-12 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition-transform group-hover:scale-110">
                    <PlayIcon size={20} className="ml-0.5 fill-white" />
                  </span>
                  <span className="absolute right-2.5 bottom-2.5 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white">{fmtClock(r.durationSec)}</span>
                </div>
                <div className="p-4">
                  <p className="truncate font-semibold">{meeting?.title ?? "Reunião removida"}</p>
                  <p className="mt-0.5 text-xs text-muted">{fmtDateTime(r.createdAt)}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge>{plural(r.chapters.length, "capítulo", "capítulos")}</Badge>
                    {r.notes.length > 0 && <Badge tone="accent">{plural(r.notes.length, "anotação", "anotações")}</Badge>}
                    {me.role === "commission" && <Badge tone={r.visibility === "team" ? "accent" : "muted"}>{r.visibility === "team" ? "Time todo" : "Convidados"}</Badge>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <Empty
            icon={Clapperboard}
            title={q ? "Nada encontrado" : "Nenhuma gravação ainda"}
            text={me.role === "commission" ? "Na sala ao vivo de uma reunião com gravação ativada, use o botão Gravar." : "Quando a comissão liberar uma gravação para você, ela aparece aqui."}
          />
        </Card>
      )}
    </>
  );
}

// ---------------- Player ----------------

export function RecordingPlayer({ data, me, recording }: { data: Data; me: Member; recording: Recording }) {
  const isCommission = me.role === "commission";
  const meeting = data.meetings.find((m) => m.id === recording.meetingId);
  const video = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [time, setTime] = useState(0);
  const [note, setNote] = useState("");

  useEffect(() => {
    let objectUrl: string | null = null;
    blobs
      .get(recording.id)
      .then((blob) => {
        if (!blob) return setMissing(true);
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setMissing(true));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [recording.id]);

  // Vídeos gravados pelo navegador (webm) não trazem a duração; forçamos o cálculo para permitir pular entre capítulos.
  function onLoaded() {
    const v = video.current;
    if (!v || Number.isFinite(v.duration)) return;
    const reset = () => {
      v.removeEventListener("timeupdate", reset);
      v.currentTime = 0;
    };
    v.addEventListener("timeupdate", reset);
    v.currentTime = 1e101;
  }

  function seek(t: number) {
    const v = video.current;
    if (!v) return;
    v.currentTime = t;
    v.play().catch(() => undefined);
  }

  async function addNote(e: FormEvent) {
    e.preventDefault();
    await api.addRecordingNote(recording.id, time, note);
    setNote("");
  }

  const currentChapter = [...recording.chapters].reverse().find((c) => c.t <= time + 0.5);

  return (
    <>
      <PageHeader
        back="/gravacoes"
        eyebrow="Gravação"
        title={meeting?.title ?? "Reunião removida"}
        subtitle={`${fmtDateTime(recording.createdAt)} · ${fmtClock(recording.durationSec)} · gravada por ${memberName(data, recording.createdBy)}`}
        actions={
          url && (
            <a className="btn btn-secondary btn-sm" href={url} download={`${meeting?.title ?? "gravacao"}.webm`}>
              <Download size={16} /> Baixar
            </a>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="card overflow-hidden bg-black">
            {missing ? (
              <div className="grid aspect-video place-items-center p-6 text-center">
                <div>
                  <p className="font-bold">Arquivo indisponível neste aparelho</p>
                  <p className="mt-1 max-w-md text-sm text-muted">Nesta fase, o vídeo fica salvo no navegador onde foi gravado. Com o servidor, passa a ficar disponível para todos.</p>
                </div>
              </div>
            ) : (
              <video ref={video} src={url ?? undefined} controls className="aspect-video w-full" onLoadedMetadata={onLoaded} onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} />
            )}
          </div>
          {currentChapter && (
            <p className="text-sm text-muted">
              Capítulo atual: <span className="font-semibold text-ink">{currentChapter.title}</span>
            </p>
          )}
          {meeting?.summary && (
            <Link to={`/reunioes/${meeting.id}/resumo`} className="inline-flex text-sm font-semibold text-accent hover:underline">
              Ver resumo da reunião
            </Link>
          )}
        </div>

        <aside className="space-y-6">
          <Card title="Capítulos">
            <ol className="space-y-1">
              {recording.chapters.map((c, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => seek(c.t)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-2 ${currentChapter === c ? "bg-accent/10 text-ink" : "text-muted"}`}
                  >
                    <span className="font-mono text-xs text-accent">{fmtClock(c.t)}</span>
                    <span className="flex-1 truncate">{c.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </Card>

          <Card title="Anotações da comissão">
            {recording.notes.length ? (
              <ul className="space-y-2">
                {recording.notes.map((n) => (
                  <li key={n.id} className="group flex items-start gap-2.5 rounded-lg bg-surface-2 px-3 py-2.5">
                    <button type="button" onClick={() => seek(n.t)} className="font-mono text-xs text-accent hover:underline">
                      {fmtClock(n.t)}
                    </button>
                    <span className="flex-1 text-sm">{n.text}</span>
                    {isCommission && (
                      <button type="button" title="Remover" onClick={() => api.removeRecordingNote(recording.id, n.id)} className="text-muted opacity-0 group-hover:opacity-100 hover:text-danger">
                        <X size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{isCommission ? "Pause no momento importante e marque uma anotação." : "Sem anotações."}</p>
            )}
            {isCommission && !missing && (
              <form onSubmit={addNote} className="mt-4 space-y-2">
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="O que o time deve observar aqui" />
                <Button type="submit" small icon={BookmarkPlus} disabled={!note.trim()}>
                  Marcar em {fmtClock(time)}
                </Button>
              </form>
            )}
          </Card>

          {isCommission && (
            <Card title="Quem pode assistir">
              <Segmented
                value={recording.visibility}
                onChange={(v) => api.setRecordingVisibility(recording.id, v)}
                options={[
                  { value: "invited", label: "Convidados" },
                  { value: "team", label: "Time todo" },
                ]}
              />
              <p className="mt-3 text-xs text-muted">{recording.visibility === "team" ? "Todo o elenco vê esta gravação." : "Só quem foi convidado para a reunião vê esta gravação."}</p>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-xs text-muted">
                <span>{fmtSize(recording.size)}</span>
                <Button
                  small
                  variant="danger"
                  icon={Trash2}
                  onClick={async () => {
                    if (confirm("Excluir esta gravação? Não dá para desfazer.")) {
                      await api.deleteRecording(recording.id);
                      go("/gravacoes");
                    }
                  }}
                >
                  Excluir
                </Button>
              </div>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
