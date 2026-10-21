import { ComponentType, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  Circle,
  CircleDot,
  MousePointer2,
  Pencil,
  Redo2,
  Search,
  Spline,
  Trash2,
  Type,
  Undo2,
  Upload,
} from "lucide-react";
import { BallIcon, BOARD_COLORS, BOARD_H, BOARD_W, BoardSvg, FIELDS, QB_COLOR, routePath } from "../components/Board";
import { Badge, Button, Card, Empty, ErrorText, Field, PageHeader, Segmented, useAction } from "../components/ui";
import { fmtDateTime } from "../lib/format";
import { Link, go } from "../lib/router";
import { memberName, visiblePlays } from "../lib/selectors";
import { api } from "../lib/store";
import type { BoardElement, Data, FieldKind, Member, Play, Team } from "../lib/types";

type Tool = "select" | "player-a" | "player-b" | "ball" | "route" | "text";
type RouteStyle = "solid" | "dashed" | "block";

const TOOLS: { value: Tool; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { value: "select", label: "Mover", icon: MousePointer2 },
  { value: "player-a", label: "Jogador (time)", icon: CircleDot },
  { value: "player-b", label: "Jogador (adversário)", icon: Circle },
  { value: "ball", label: "Bola", icon: BallIcon },
  { value: "route", label: "Rota", icon: Spline },
  { value: "text", label: "Texto", icon: Type },
];

const uid = () => crypto.randomUUID();
const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));

// ---------------- Lousa (editor) ----------------

export function BoardEditor({ team, play }: { team: Team; play?: Play }) {
  const [elements, setElements] = useState<BoardElement[]>(play?.elements ?? []);
  const [past, setPast] = useState<BoardElement[][]>([]);
  const [future, setFuture] = useState<BoardElement[][]>([]);
  const [field, setField] = useState<FieldKind>(play?.field ?? "gridiron");
  const [tool, setTool] = useState<Tool>("player-a");
  const [color, setColor] = useState(BOARD_COLORS[0]);
  const [routeStyle, setRouteStyle] = useState<RouteStyle>("solid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [form, setForm] = useState({ name: play?.name ?? "", formation: play?.formation ?? "", notes: play?.notes ?? "", groups: play?.groups ?? [] });
  const { busy, error, setError, run } = useAction();
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; start: [number, number]; original: BoardElement } | null>(null);

  const selected = elements.find((e) => e.id === selectedId) ?? null;

  function commit(next: BoardElement[]) {
    setPast((p) => [...p.slice(-60), elements]);
    setFuture([]);
    setElements(next);
  }
  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [elements, ...f]);
    setElements(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setSelectedId(null);
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, elements]);
    setElements(future[0]);
    setFuture((f) => f.slice(1));
  };
  const update = (id: string, patch: Partial<BoardElement>) => commit(elements.map((e) => (e.id === id ? ({ ...e, ...patch } as BoardElement) : e)));
  const remove = (id: string) => {
    commit(elements.filter((e) => e.id !== id));
    setSelectedId(null);
  };

  function point(e: { clientX: number; clientY: number }): [number, number] {
    const el = svg.current!;
    const pt = el.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(el.getScreenCTM()!.inverse());
    return [Math.round(clamp(p.x, BOARD_W)), Math.round(clamp(p.y, BOARD_H))];
  }

  function snapToPlayer([x, y]: [number, number]): [number, number] {
    const p = elements.find((e) => e.kind === "player" && Math.hypot(e.x - x, e.y - y) < 28);
    return p && p.kind === "player" ? [p.x, p.y] : [x, y];
  }

  function finishRoute() {
    if (draft.length >= 2) commit([...elements, { id: uid(), kind: "route", points: draft, color, style: routeStyle }]);
    setDraft([]);
  }

  // Cliques em jogadores/rotas que já foram tratados não chegam aqui (stopPropagation).
  function onBackgroundDown(e: ReactPointerEvent<SVGSVGElement>) {
    const p = point(e);
    if (tool === "select") return setSelectedId(null);
    if (tool === "player-a" || tool === "player-b") {
      const side = tool === "player-a" ? "a" : "b";
      const isQb = side === "a" && color === QB_COLOR;
      const count = elements.filter((el) => el.kind === "player" && el.side === side && el.label !== "QB").length + 1;
      const label = isQb ? "QB" : `${side === "a" ? "" : "D"}${count}`;
      const el: BoardElement = { id: uid(), kind: "player", x: p[0], y: p[1], side, label, color: side === "a" ? color : color === "#ffffff" ? "#ff5a5f" : color };
      commit([...elements, el]);
      return;
    }
    if (tool === "ball") {
      // uma bola por jogada: clicar de novo leva a bola para o novo lugar
      const ball = elements.find((el) => el.kind === "ball");
      commit(ball ? elements.map((el) => (el.id === ball.id ? { ...ball, x: p[0], y: p[1] } : el)) : [...elements, { id: uid(), kind: "ball", x: p[0], y: p[1] }]);
      return;
    }
    if (tool === "route") {
      setDraft((d) => [...d, d.length ? p : snapToPlayer(p)]);
      return;
    }
    if (tool === "text") {
      const el: BoardElement = { id: uid(), kind: "text", x: p[0], y: p[1], text: "Texto", color };
      commit([...elements, el]);
      setSelectedId(el.id);
      setTool("select");
    }
  }

  function onElementDown(el: BoardElement, e: ReactPointerEvent<SVGGElement>) {
    if (tool === "route") {
      // começar uma rota a partir de um jogador
      if (el.kind === "player") {
        e.stopPropagation();
        setDraft((d) => [...d, [el.x, el.y]]);
      }
      return;
    }
    if (tool !== "select") return;
    e.stopPropagation();
    setSelectedId(el.id);
    drag.current = { id: el.id, start: point(e), original: el };
    setPast((p) => [...p.slice(-60), elements]);
    setFuture([]);
    (e.currentTarget.ownerSVGElement ?? svg.current)?.setPointerCapture(e.pointerId);
  }

  function onMove(e: ReactPointerEvent<SVGSVGElement>) {
    const p = point(e);
    if (draft.length) setHover(p);
    const d = drag.current;
    if (!d) return;
    const dx = p[0] - d.start[0];
    const dy = p[1] - d.start[1];
    const o = d.original;
    setElements((list) =>
      list.map((el) => {
        if (el.id !== d.id) return el;
        if (o.kind === "route") return { ...o, points: o.points.map(([x, y]) => [clamp(x + dx, BOARD_W), clamp(y + dy, BOARD_H)] as [number, number]) };
        return { ...o, x: clamp((o as { x: number }).x + dx, BOARD_W), y: clamp((o as { y: number }).y + dy, BOARD_H) } as BoardElement;
      }),
    );
  }

  function onUp() {
    drag.current = null;
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = (e.target as HTMLElement).closest("input,textarea,select");
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "Enter" && draft.length) finishRoute();
      else if (e.key === "Escape") {
        setDraft([]);
        setSelectedId(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) remove(selectedId);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function save(published: boolean) {
    if (!form.name.trim()) return setError("Dê um nome para a jogada.");
    if (!elements.length) return setError("Desenhe a jogada antes de salvar.");
    let saved: Play | undefined;
    const ok = await run(async () => {
      saved = await api.savePlay({ ...form, field, elements, published }, play?.id);
    });
    if (ok && saved) go(`/playbook/${saved.id}`);
  }

  return (
    <>
      <PageHeader
        back={play ? `/playbook/${play.id}` : "/playbook"}
        eyebrow={play ? "Editando jogada" : "Nova jogada"}
        title="Lousa tática"
        subtitle="Posicione jogadores, desenhe rotas e salve no playbook."
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          {/* Barra de ferramentas */}
          <div className="card flex flex-wrap items-center gap-2 p-2">
            {TOOLS.map((t) => (
              <button
                key={t.value}
                type="button"
                title={t.label}
                onClick={() => {
                  setTool(t.value);
                  setDraft([]);
                }}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold ${tool === t.value ? "bg-accent text-on-accent" : "text-muted hover:bg-surface-3 hover:text-ink"}`}
              >
                <t.icon size={16} strokeWidth={1.8} /> <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
            <span className="mx-1 h-6 w-px bg-line-2" />
            {tool === "route" && (
              <select className="input h-9 w-auto py-0 text-[13px]" value={routeStyle} onChange={(e) => setRouteStyle(e.target.value as RouteStyle)}>
                <option value="solid">Rota (contínua)</option>
                <option value="dashed">Movimento (tracejada)</option>
                <option value="block">Bloqueio</option>
              </select>
            )}
            <div className="flex items-center gap-1.5">
              {BOARD_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(c);
                    if (!selected || selected.kind === "ball") return;
                    if (selected.kind === "player" && selected.side === "a" && c === QB_COLOR) update(selected.id, { color: c, label: "QB" });
                    else update(selected.id, { color: c });
                  }}
                  title={c === QB_COLOR ? "QB (quarterback)" : "Cor"}
                  className={`grid size-6 place-items-center rounded-full border border-white/20 text-[9px] leading-none font-extrabold text-white ${color === c ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""}`}
                  style={{ background: c }}
                >
                  {c === QB_COLOR && "QB"}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button type="button" title="Desfazer (Ctrl+Z)" disabled={!past.length} onClick={undo} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink disabled:opacity-30">
                <Undo2 size={16} />
              </button>
              <button type="button" title="Refazer (Ctrl+Y)" disabled={!future.length} onClick={redo} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink disabled:opacity-30">
                <Redo2 size={16} />
              </button>
              <button
                type="button"
                title="Limpar lousa"
                disabled={!elements.length}
                onClick={() => {
                  if (confirm("Apagar tudo da lousa?")) {
                    commit([]);
                    setSelectedId(null);
                  }
                }}
                className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-danger disabled:opacity-30"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <BoardSvg
              svgRef={svg}
              field={field}
              elements={elements}
              selectedId={selectedId}
              onElementDown={onElementDown}
              onPointerDown={onBackgroundDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onDoubleClick={() => tool === "route" && finishRoute()}
              style={{ cursor: tool === "select" ? "default" : "crosshair" }}
            >
              {draft.length > 0 && (
                <g pointerEvents="none">
                  <path d={routePath(hover ? [...draft, hover] : draft)} stroke={color} strokeWidth={4} fill="none" strokeDasharray="6 6" opacity={0.8} />
                  {draft.map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r={5} fill={color} />
                  ))}
                </g>
              )}
            </BoardSvg>
          </div>
          <p className="text-xs text-muted">
            {tool === "route"
              ? draft.length
                ? "Clique para adicionar pontos. Duplo clique ou Enter conclui a rota; Esc cancela."
                : "Clique num jogador (ou no campo) para começar a rota."
              : tool === "select"
                ? "Arraste para mover. Delete remove o item selecionado. Ctrl+Z desfaz."
                : tool === "ball"
                  ? "Clique no campo para posicionar a bola. Jogador do time na cor preta vira o QB."
                  : tool === "player-a"
                    ? "Clique no campo para adicionar. Na cor preta, o jogador entra como QB."
                    : "Clique no campo para adicionar."}
            {draft.length >= 2 && (
              <button type="button" onClick={finishRoute} className="ml-2 font-semibold text-accent hover:underline">
                Concluir rota
              </button>
            )}
          </p>
        </div>

        <aside className="space-y-4">
          {selected && (
            <Card title={{ player: "Jogador", route: "Rota", text: "Texto", ball: "Bola" }[selected.kind]}>
              <div className="space-y-3">
                {selected.kind === "player" && (
                  <Field label="Rótulo">
                    <input className="input" maxLength={4} value={selected.label} onChange={(e) => setElements((l) => l.map((x) => (x.id === selected.id ? { ...x, label: e.target.value } : x)) as BoardElement[])} />
                  </Field>
                )}
                {selected.kind === "text" && (
                  <Field label="Texto">
                    <input className="input" maxLength={40} value={selected.text} onChange={(e) => setElements((l) => l.map((x) => (x.id === selected.id ? { ...x, text: e.target.value } : x)) as BoardElement[])} />
                  </Field>
                )}
                {selected.kind === "route" && (
                  <Field label="Tipo">
                    <select className="input" value={selected.style} onChange={(e) => update(selected.id, { style: e.target.value as RouteStyle })}>
                      <option value="solid">Rota (contínua)</option>
                      <option value="dashed">Movimento (tracejada)</option>
                      <option value="block">Bloqueio</option>
                    </select>
                  </Field>
                )}
                <Button small variant="danger" icon={Trash2} onClick={() => remove(selected.id)}>
                  Remover
                </Button>
              </div>
            </Card>
          )}

          <Card title="Jogada">
            <div className="space-y-4">
              <Field label="Nome">
                <input className="input" value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome da jogada" />
              </Field>
              <Field label="Formação (opcional)">
                <input className="input" value={form.formation} maxLength={40} onChange={(e) => setForm({ ...form, formation: e.target.value })} />
              </Field>
              <Field label="Campo">
                <select className="input" value={field} onChange={(e) => setField(e.target.value as FieldKind)}>
                  {FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div>
                <span className="label">Para quais grupos</span>
                {team.groups.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {team.groups.map((g) => {
                      const on = form.groups.includes(g);
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setForm({ ...form, groups: on ? form.groups.filter((x) => x !== g) : [...form.groups, g] })}
                          className={`h-8 rounded-full border px-3 text-xs font-semibold ${on ? "border-accent bg-accent/15 text-ink" : "border-line-2 text-muted hover:text-ink"}`}
                        >
                          {g}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <p className="mt-1.5 text-xs text-muted">{form.groups.length ? "Só esses grupos veem a jogada." : "Sem grupo marcado, todo o elenco vê."}</p>
              </div>
              <Field label="Orientação para o atleta">
                <textarea className="input min-h-24" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Leituras, tempo, ajustes…" />
              </Field>
            </div>
          </Card>
          <ErrorText>{error}</ErrorText>
          <div className="grid gap-2">
            <Button variant="primary" icon={Upload} disabled={busy} onClick={() => save(true)}>
              {play?.published ? "Salvar e manter publicada" : "Publicar no playbook"}
            </Button>
            <Button icon={Check} disabled={busy} onClick={() => save(false)}>
              {play?.published ? "Salvar como rascunho" : "Salvar rascunho"}
            </Button>
          </div>
          <p className="text-xs text-muted">Rascunhos só a comissão vê. Ao publicar, os grupos escolhidos recebem um aviso no app.</p>
        </aside>
      </div>
    </>
  );
}

// ---------------- Playbook ----------------

export function PlaybookList({ data, me, team }: { data: Data; me: Member; team: Team }) {
  const isCommission = me.role === "commission";
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const q = query.trim().toLowerCase();
  const plays = visiblePlays(data, me)
    .filter((p) => group === "all" || p.groups.includes(group))
    .filter((p) => !q || [p.name, p.formation, p.notes].join(" ").toLowerCase().includes(q));
  const groups = isCommission ? team.groups : team.groups.filter((g) => me.groups.includes(g));

  return (
    <>
      <PageHeader
        title="Playbook"
        subtitle={isCommission ? "Jogadas do time. Rascunhos só a comissão vê." : "Jogadas publicadas para você. Somente consulta."}
        actions={
          isCommission && (
            <Button variant="primary" icon={Pencil} onClick={() => go("/lousa")}>
              Nova jogada
            </Button>
          )
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
          <input className="input pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome, formação…" />
        </div>
        {groups.length > 0 && <Segmented value={group} onChange={setGroup} options={[{ value: "all", label: "Todas" }, ...groups.map((g) => ({ value: g, label: g }))]} />}
      </div>
      {plays.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plays.map((p) => (
            <Link key={p.id} to={`/playbook/${p.id}`} className="group card overflow-hidden transition-colors hover:border-line-2">
              <BoardSvg field={p.field} elements={p.elements} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-semibold">{p.name}</p>
                  {isCommission && <Badge tone={p.published ? "accent" : "muted"}>{p.published ? "Publicada" : "Rascunho"}</Badge>}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">{[p.formation, p.groups.join(", ") || "Time todo"].filter(Boolean).join(" · ")}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <Empty
            icon={BookOpen}
            title={q || group !== "all" ? "Nada encontrado" : "Playbook vazio"}
            text={isCommission ? "Desenhe uma jogada na lousa tática e publique para o elenco." : "Quando a comissão publicar jogadas para você, elas aparecem aqui."}
            action={isCommission && !q && <Button variant="primary" icon={Pencil} onClick={() => go("/lousa")}>Abrir lousa tática</Button>}
          />
        </Card>
      )}
    </>
  );
}

export function PlayDetail({ data, me, play }: { data: Data; me: Member; play: Play }) {
  const isCommission = me.role === "commission";
  const { busy, run } = useAction();

  return (
    <>
      <PageHeader
        back="/playbook"
        eyebrow={isCommission ? (play.published ? "Publicada" : "Rascunho") : "Jogada publicada · somente consulta"}
        title={play.name}
        subtitle={[play.formation, play.groups.join(", ") || "Time todo", `atualizada ${fmtDateTime(play.updatedAt)}`].filter(Boolean).join(" · ")}
        actions={
          isCommission && (
            <>
              <Button icon={Pencil} onClick={() => go(`/lousa/${play.id}`)}>
                Editar na lousa
              </Button>
              <Button variant="primary" icon={Upload} disabled={busy} onClick={() => run(() => api.savePlay({ ...play, published: !play.published }, play.id))}>
                {play.published ? "Despublicar" : "Publicar"}
              </Button>
            </>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card overflow-hidden">
          <BoardSvg field={play.field} elements={play.elements} />
        </div>
        <aside className="space-y-4">
          <Card title="Orientação do coach">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink/90">{play.notes || "Sem orientação escrita."}</p>
            <p className="mt-4 text-xs text-muted">Por {memberName(data, play.createdBy)}</p>
          </Card>
          {isCommission && (
            <Button
              variant="danger"
              icon={Trash2}
              className="w-full"
              onClick={async () => {
                if (confirm(`Excluir a jogada "${play.name}"?`)) {
                  await api.deletePlay(play.id);
                  go("/playbook");
                }
              }}
            >
              Excluir jogada
            </Button>
          )}
        </aside>
      </div>
    </>
  );
}
