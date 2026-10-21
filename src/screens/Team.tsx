import { FormEvent, useState } from "react";
import { Check, ChevronRight, ImagePlus, Plus, Search, Trash2, UserPlus, Users, X } from "lucide-react";
import { Avatar, Badge, Button, Card, CopyButton, Crest, Empty, ErrorText, Field, ICON, PageHeader, Segmented, useAction } from "../components/ui";
import { Link, go } from "../lib/router";
import { teamMembers } from "../lib/selectors";
import { api, inviteLink, type NewMemberInput } from "../lib/store";
import { TEAM_COLORS } from "../lib/theme";
import type { Data, Member, Role, Team } from "../lib/types";

function inviteState(m: Member) {
  if (m.status === "active") return <Badge tone="accent">Ativo</Badge>;
  if (new Date(m.inviteExpiresAt).getTime() < Date.now()) return <Badge tone="danger">Convite expirado</Badge>;
  return <Badge tone="warn">Convite enviado</Badge>;
}

// ---------------- Elenco ----------------

export function Roster({ data, me, team }: { data: Data; me: Member; team: Team }) {
  const [filter, setFilter] = useState<"all" | Role | "invited">("all");
  const [query, setQuery] = useState("");
  const members = teamMembers(data, team.id);
  const q = query.trim().toLowerCase();
  const list = members
    .filter((m) => (filter === "all" ? true : filter === "invited" ? m.status === "invited" : m.role === filter))
    .filter((m) => !q || [m.name, m.email, m.position, m.number, m.title, ...m.groups].join(" ").toLowerCase().includes(q))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "commission" ? -1 : 1));

  return (
    <>
      <PageHeader
        title="Elenco"
        subtitle={`${members.filter((m) => m.role === "athlete").length} atletas · ${members.filter((m) => m.role === "commission").length} na comissão`}
        actions={
          <Button variant="primary" icon={UserPlus} onClick={() => go("/elenco/novo")}>
            Cadastrar pessoa
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Todos" },
            { value: "athlete", label: "Atletas" },
            { value: "commission", label: "Comissão" },
            { value: "invited", label: "Convites pendentes" },
          ]}
        />
        <div className="relative min-w-56 flex-1">
          <Search size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
          <input className="input pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, posição, grupo…" />
        </div>
      </div>
      <Card padded={false} className="p-2">
        {list.length ? (
          list.map((m) => (
            <Link key={m.id} to={`/elenco/${m.id}`} className="group flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2">
              <Avatar name={m.name} size={38} muted={m.status !== "active"} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {m.name} {m.id === me.id && <span className="text-xs font-normal text-muted">(você)</span>}
                </p>
                <p className="truncate text-xs text-muted">
                  {[m.title, m.position, m.number && `#${m.number}`, ...m.groups].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="hidden sm:block">{inviteState(m)}</div>
              <ChevronRight {...ICON} size={16} className="text-muted group-hover:text-ink" />
            </Link>
          ))
        ) : (
          <Empty
            icon={Users}
            title={members.length <= 1 ? "Seu elenco está vazio" : "Ninguém encontrado"}
            text={members.length <= 1 ? "Cadastre atletas e membros da comissão. Cada pessoa recebe um link para ativar o acesso." : "Tente outro filtro ou busca."}
            action={members.length <= 1 && <Button variant="primary" icon={UserPlus} onClick={() => go("/elenco/novo")}>Cadastrar pessoa</Button>}
          />
        )}
      </Card>
    </>
  );
}

// ---------------- Cadastrar / editar pessoa ----------------

function GroupPicker({ team, value, onChange }: { team: Team; value: string[]; onChange: (v: string[]) => void }) {
  const [newGroup, setNewGroup] = useState("");
  return (
    <div>
      <span className="label">Grupos</span>
      <div className="flex flex-wrap gap-2">
        {team.groups.map((g) => {
          const on = value.includes(g);
          return (
            <button
              key={g}
              type="button"
              onClick={() => onChange(on ? value.filter((x) => x !== g) : [...value, g])}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold ${on ? "border-accent bg-accent/15 text-ink" : "border-line-2 text-muted hover:text-ink"}`}
            >
              {on && <Check size={14} />} {g}
            </button>
          );
        })}
        <div className="flex h-9 items-center rounded-full border border-dashed border-line-2 pl-3.5">
          <input
            className="w-32 bg-transparent text-[13px] outline-none placeholder:text-muted/70"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.currentTarget.nextElementSibling as HTMLButtonElement)?.click();
              }
            }}
            placeholder="Novo grupo"
          />
          <button
            type="button"
            className="grid size-8 place-items-center text-muted hover:text-ink"
            onClick={async () => {
              const g = newGroup.trim();
              if (!g) return;
              await api.addGroup(g);
              if (!value.includes(g)) onChange([...value, g]);
              setNewGroup("");
            }}
          >
            <Plus size={15} />
          </button>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted">Grupos definem o público das reuniões (ex.: setor, posição, categoria). Cada time organiza do seu jeito.</p>
    </div>
  );
}

const emptyMember = (): NewMemberInput => ({ name: "", email: "", role: "athlete", title: "Atleta", position: "", number: "", groups: [] });

export function MemberForm({ data, me, team, member }: { data: Data; me: Member; team: Team; member?: Member }) {
  const editing = !!member;
  const [form, setForm] = useState<NewMemberInput>(member ? { ...member } : emptyMember());
  const [created, setCreated] = useState<Member | null>(null);
  const { busy, error, run } = useAction();
  const current = member ? data.members.find((m) => m.id === member.id) ?? member : undefined;

  const set = (patch: Partial<NewMemberInput>) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (editing) {
      if (await run(() => api.updateMember(member.id, { name: form.name, role: form.role, title: form.title, position: form.position, number: form.number, groups: form.groups }))) go("/elenco");
      return;
    }
    await run(async () => setCreated(await api.inviteMember(form)));
  }

  if (created) {
    const fresh = data.members.find((m) => m.id === created.id) ?? created;
    return (
      <>
        <PageHeader back="/elenco" title="Pessoa cadastrada" />
        <Card className="mx-auto max-w-xl">
          <div className="flex items-center gap-3">
            <Avatar name={fresh.name} size={48} />
            <div>
              <p className="font-bold">{fresh.name}</p>
              <p className="text-sm text-muted">{fresh.email}</p>
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-line-2 bg-surface-2 p-4">
            <p className="text-sm font-semibold">Link do convite</p>
            <p className="mt-1 text-xs text-muted">O envio por e-mail entra junto com o backend. Por enquanto, copie o link e mande para a pessoa. Ele expira em 7 dias.</p>
            <p className="mt-3 truncate rounded-lg bg-bg px-3 py-2 font-mono text-xs text-muted">{inviteLink(fresh)}</p>
            <div className="mt-3">
              <CopyButton text={inviteLink(fresh)} />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" icon={UserPlus} onClick={() => { setCreated(null); setForm({ ...emptyMember(), role: form.role, title: form.title }); }}>
              Cadastrar outra pessoa
            </Button>
            <Button onClick={() => go("/elenco")}>Ver elenco</Button>
          </div>
        </Card>
      </>
    );
  }

  return (
    <form onSubmit={submit}>
      <PageHeader back="/elenco" title={editing ? form.name || "Editar pessoa" : "Cadastrar pessoa"} subtitle={editing ? current?.email : "A pessoa recebe um link de convite para criar a senha e entrar no time."} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="space-y-5">
            <Field label="Tipo de acesso">
              <Segmented
                value={form.role}
                onChange={(role) => set({ role, title: !editing ? (role === "athlete" ? "Atleta" : "") : form.title })}
                options={[
                  { value: "athlete", label: "Atleta" },
                  { value: "commission", label: "Comissão técnica" },
                ]}
              />
            </Field>
            <p className="-mt-2 text-xs text-muted">
              {form.role === "commission" ? "Comissão cria e conduz reuniões, publica resumos e gerencia o elenco." : "Atleta vê só as reuniões e materiais para os quais for convidado."}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome completo">
                <input className="input" required value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </Field>
              <Field label={editing ? "E-mail · não editável" : "E-mail"}>
                <input className="input disabled:opacity-60" type="email" required disabled={editing} value={form.email} onChange={(e) => set({ email: e.target.value })} />
              </Field>
              <Field label="Função" hint={form.role === "commission" ? "Ex.: Head Coach, Coordenador, Diretor" : "Ex.: Atleta, Capitão"}>
                <input className="input" required value={form.title} onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <div className="grid grid-cols-[1fr_96px] gap-3">
                <Field label="Posição (opcional)">
                  <input className="input" value={form.position} onChange={(e) => set({ position: e.target.value })} />
                </Field>
                <Field label="Número">
                  <input className="input" value={form.number} maxLength={4} onChange={(e) => set({ number: e.target.value })} />
                </Field>
              </div>
            </div>
            <GroupPicker team={team} value={form.groups} onChange={(groups) => set({ groups })} />
          </div>
        </Card>
        <aside className="space-y-4">
          {current && (
            <Card title="Acesso" action={inviteState(current)}>
              {current.status === "invited" ? (
                <>
                  <p className="text-sm text-muted">Envie o link para a pessoa ativar o acesso.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <CopyButton text={inviteLink(current)} />
                    <Button small onClick={() => api.renewInvite(current.id)}>
                      Renovar convite
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted">Conta ativa. A pessoa entra com o próprio e-mail e senha.</p>
              )}
            </Card>
          )}
          <ErrorText>{error}</ErrorText>
          <Button type="submit" variant="primary" icon={editing ? Check : UserPlus} className="w-full" disabled={busy}>
            {editing ? "Salvar alterações" : "Cadastrar e gerar convite"}
          </Button>
          {editing && member.id !== me.id && (
            <Button
              variant="danger"
              icon={Trash2}
              className="w-full"
              onClick={async () => {
                if (confirm(`Remover ${member.name} do time?`) && (await run(() => api.removeMember(member.id)))) go("/elenco");
              }}
            >
              Remover do time
            </Button>
          )}
        </aside>
      </div>
    </form>
  );
}

// ---------------- Time ----------------

export function TeamSettings({ team }: { team: Team }) {
  const [form, setForm] = useState({ name: team.name, sport: team.sport, color: team.color, crest: team.crest ?? "" });
  const [group, setGroup] = useState("");
  const [saved, setSaved] = useState(false);
  const { busy, error, setError, run } = useAction();

  function pickCrest(file: File | undefined) {
    if (!file) return;
    if (file.size > 600_000) return setError("Escolha uma imagem de até 600 KB.");
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, crest: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError("Informe o nome do time.");
    if (await run(() => api.updateTeam({ name: form.name.trim(), sport: form.sport.trim(), color: form.color, crest: form.crest || undefined }))) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <>
      <PageHeader title="Time" subtitle="Identidade e organização do seu time." />
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={submit}>
          <Card title="Identidade">
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div style={{ ["--accent" as string]: form.color }}>
                  <Crest team={{ name: form.name, crest: form.crest }} size={64} />
                </div>
                <label className="btn btn-secondary btn-sm cursor-pointer">
                  <ImagePlus size={16} /> {form.crest ? "Trocar escudo" : "Enviar escudo"}
                  <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="sr-only" onChange={(e) => pickCrest(e.target.files?.[0])} />
                </label>
                {form.crest && (
                  <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => setForm({ ...form, crest: "" })}>
                    Remover
                  </button>
                )}
              </div>
              <Field label="Nome do time">
                <input className="input" required maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Modalidade (opcional)">
                <input className="input" maxLength={30} value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} />
              </Field>
              <div>
                <span className="label">Cor da plataforma</span>
                <div className="flex flex-wrap items-center gap-2.5">
                  {TEAM_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.name}
                      onClick={() => setForm({ ...form, color: c.value })}
                      className={`grid size-9 place-items-center rounded-full ring-offset-2 ring-offset-surface ${form.color.toLowerCase() === c.value.toLowerCase() ? "ring-2 ring-white" : ""}`}
                      style={{ background: c.value }}
                    >
                      {form.color.toLowerCase() === c.value.toLowerCase() && <Check size={16} strokeWidth={3} color="#fff" />}
                    </button>
                  ))}
                  <label title="Cor personalizada" className="relative grid size-9 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-line-2 text-xs text-muted">
                    +
                    <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                  </label>
                </div>
              </div>
              <ErrorText>{error}</ErrorText>
              <Button type="submit" variant="primary" icon={Check} disabled={busy}>
                {saved ? "Salvo" : "Salvar identidade"}
              </Button>
            </div>
          </Card>
        </form>

        <Card title="Grupos">
          <p className="mb-4 text-sm text-muted">Use grupos para organizar o elenco e escolher o público das reuniões. Ex.: setores, posições, categorias, turmas.</p>
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await api.addGroup(group);
              setGroup("");
            }}
          >
            <input className="input" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Nome do grupo" maxLength={30} />
            <Button type="submit" icon={Plus} disabled={!group.trim()}>
              Criar
            </Button>
          </form>
          {team.groups.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {team.groups.map((g) => (
                <span key={g} className="inline-flex h-9 items-center gap-1 rounded-full border border-line-2 bg-surface-2 pr-1.5 pl-3.5 text-[13px] font-semibold">
                  {g}
                  <button
                    type="button"
                    className="grid size-6 place-items-center rounded-full text-muted hover:bg-surface-3 hover:text-danger"
                    title={`Remover ${g}`}
                    onClick={() => {
                      if (confirm(`Remover o grupo "${g}"? As pessoas continuam no time.`)) api.removeGroup(g);
                    }}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">Nenhum grupo criado.</p>
          )}
        </Card>
      </div>
    </>
  );
}
