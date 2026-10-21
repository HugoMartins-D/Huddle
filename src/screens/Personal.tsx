import { FormEvent, useState } from "react";
import { Bell, Check, CheckCircle2, CheckSquare, ChevronRight, LogOut } from "lucide-react";
import { Avatar, Badge, Button, Card, Empty, ErrorText, Field, ICON, PageHeader, Segmented, useAction } from "../components/ui";
import { fmtAgo, fmtDateTime, fmtDue, isOverdue } from "../lib/format";
import { Link, go } from "../lib/router";
import { memberName } from "../lib/selectors";
import { api } from "../lib/store";
import type { Data, Member, Task, Team } from "../lib/types";

// ---------------- Tarefas ----------------

export function TasksList({ data, me }: { data: Data; me: Member }) {
  const isCommission = me.role === "commission";
  const [scope, setScope] = useState<"mine" | "team">(isCommission ? "team" : "mine");
  const [tab, setTab] = useState<"pending" | "done">("pending");
  const tasks = data.tasks
    .filter((t) => t.teamId === me.teamId && (scope === "team" ? true : t.assigneeId === me.id))
    .filter((t) => t.status === tab)
    .sort((a, b) => (tab === "pending" ? a.due.localeCompare(b.due) : (b.doneAt ?? "").localeCompare(a.doneAt ?? "")));

  return (
    <>
      <PageHeader
        title={isCommission ? "Próximos passos" : "Meus próximos passos"}
        subtitle={isCommission ? "Tarefas combinadas nas reuniões." : "O que ficou combinado com você. Só você conclui suas tarefas; a comissão acompanha."}
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "pending", label: "Pendentes" },
            { value: "done", label: "Concluídas" },
          ]}
        />
        {isCommission && (
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: "team", label: "Time todo" },
              { value: "mine", label: "Minhas" },
            ]}
          />
        )}
      </div>
      <Card padded={false} className="p-2">
        {tasks.length ? (
          tasks.map((t) => <TaskRow key={t.id} data={data} task={t} showAssignee={scope === "team"} />)
        ) : (
          <Empty
            icon={CheckSquare}
            title={tab === "pending" ? "Nada pendente" : "Nenhuma tarefa concluída"}
            text={tab === "pending" ? "Os próximos passos atribuídos no resumo das reuniões aparecem aqui." : undefined}
          />
        )}
      </Card>
    </>
  );
}

function TaskRow({ data, task, showAssignee }: { data: Data; task: Task; showAssignee: boolean }) {
  const meeting = data.meetings.find((m) => m.id === task.meetingId);
  const late = task.status === "pending" && isOverdue(task.due);
  return (
    <Link to={`/tarefas/${task.id}`} className="group flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2">
      <span className={`grid size-5 shrink-0 place-items-center rounded-md border ${task.status === "done" ? "border-accent bg-accent text-on-accent" : "border-line-2"}`}>
        {task.status === "done" && <Check size={13} strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-semibold ${task.status === "done" ? "text-muted line-through" : ""}`}>{task.title}</p>
        <p className="truncate text-xs text-muted">{[showAssignee && memberName(data, task.assigneeId), meeting?.title].filter(Boolean).join(" · ")}</p>
      </div>
      <span className={`shrink-0 text-xs ${late ? "font-semibold text-danger" : "text-muted"}`}>{task.status === "done" ? "Concluída" : late ? `Atrasada · ${fmtDue(task.due)}` : fmtDue(task.due)}</span>
      <ChevronRight {...ICON} size={16} className="text-muted group-hover:text-ink" />
    </Link>
  );
}

export function TaskDetail({ data, me, task }: { data: Data; me: Member; task: Task }) {
  const meeting = data.meetings.find((m) => m.id === task.meetingId);
  const mine = task.assigneeId === me.id;
  const { busy, error, run } = useAction();

  return (
    <>
      <PageHeader back="/tarefas" eyebrow={mine ? "Atribuída a você" : `Atribuída a ${memberName(data, task.assigneeId)}`} title={task.title} subtitle={meeting ? `Da reunião: ${meeting.title}` : undefined} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title="Orientação">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink/90">{task.description || "Sem orientação adicional."}</p>
          {meeting && (
            <Link to={`/reunioes/${meeting.id}/resumo`} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
              Ver resumo da reunião <ChevronRight size={15} />
            </Link>
          )}
        </Card>
        <aside className="space-y-4">
          <Card>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Prazo</dt>
                <dd className={task.status === "pending" && isOverdue(task.due) ? "font-semibold text-danger" : ""}>{fmtDue(task.due)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Responsável</dt>
                <dd>{memberName(data, task.assigneeId)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Status</dt>
                <dd>{task.status === "done" ? <Badge tone="accent">Concluída</Badge> : <Badge tone="warn">Pendente</Badge>}</dd>
              </div>
            </dl>
          </Card>
          {task.status === "done" ? (
            <Card className="border-accent/40">
              <div className="flex items-center gap-3">
                <CheckCircle2 {...ICON} size={28} className="text-accent" />
                <div>
                  <p className="font-bold">Tarefa concluída</p>
                  <p className="text-xs text-muted">{task.doneAt && fmtDateTime(task.doneAt)} · a comissão vê a atualização</p>
                </div>
              </div>
            </Card>
          ) : mine ? (
            <>
              <ErrorText>{error}</ErrorText>
              <Button variant="primary" icon={Check} className="w-full" disabled={busy} onClick={() => run(() => api.completeTask(task.id))}>
                Marcar como concluída
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted">Só o responsável conclui a tarefa.</p>
          )}
        </aside>
      </div>
    </>
  );
}

// ---------------- Notificações ----------------

export function Notifications({ data, me }: { data: Data; me: Member }) {
  const list = data.notifications.filter((n) => n.memberId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = list.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title="Notificações"
        subtitle="Avisos do seu time e das reuniões em que você participa."
        actions={unread > 0 && <Button small icon={Check} onClick={() => api.markAllRead()}>Marcar todas como lidas</Button>}
      />
      <Card padded={false} className="p-2">
        {list.length ? (
          list.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={async () => {
                await api.markRead(n.id);
                go(n.route);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-surface-2"
            >
              <span className={`size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-accent"}`} />
              <span className={`min-w-0 flex-1 text-sm ${n.readAt ? "text-muted" : "font-semibold"}`}>{n.text}</span>
              <span className="shrink-0 text-xs text-muted">{fmtAgo(n.createdAt)}</span>
            </button>
          ))
        ) : (
          <Empty icon={Bell} title="Nenhuma notificação" text="Convites, resumos publicados e tarefas aparecem aqui." />
        )}
      </Card>
    </>
  );
}

// ---------------- Perfil ----------------

export function Profile({ me, team }: { me: Member; team: Team }) {
  const [name, setName] = useState(me.name);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [savedName, setSavedName] = useState(false);
  const [savedPw, setSavedPw] = useState(false);
  const nameAction = useAction();
  const pwAction = useAction();

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (await nameAction.run(() => api.updateProfile({ name }))) {
      setSavedName(true);
      setTimeout(() => setSavedName(false), 2000);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (pw.next.length < 8) return pwAction.setError("A nova senha precisa ter pelo menos 8 caracteres.");
    if (pw.next !== pw.confirm) return pwAction.setError("As duas senhas precisam ser iguais.");
    if (await pwAction.run(() => api.changePassword(pw.current, pw.next))) {
      setPw({ current: "", next: "", confirm: "" });
      setSavedPw(true);
      setTimeout(() => setSavedPw(false), 2000);
    }
  }

  return (
    <>
      <PageHeader
        title="Meu perfil"
        actions={
          <Button icon={LogOut} onClick={() => { api.logout(); go("/login"); }}>
            Sair da conta
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-6 flex items-center gap-4">
            <Avatar name={me.name} size={64} />
            <div>
              <p className="display text-xl">{me.name}</p>
              <p className="text-sm text-muted">
                {me.title} · {team.name}
              </p>
            </div>
          </div>
          <form onSubmit={saveName} className="space-y-4">
            <Field label="Nome de exibição">
              <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="E-mail de acesso · somente leitura" hint="Para alterar o e-mail de acesso, fale com a comissão do seu time.">
              <input className="input opacity-70" readOnly value={me.email} />
            </Field>
            <ErrorText>{nameAction.error}</ErrorText>
            <Button type="submit" variant="primary" icon={Check} disabled={nameAction.busy || name.trim() === me.name}>
              {savedName ? "Dados atualizados" : "Salvar alterações"}
            </Button>
          </form>
        </Card>
        <div className="space-y-6">
          <Card title="Dados do time · somente leitura">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {[
                ["Função", me.title],
                ["Posição", me.position || "—"],
                ["Número", me.number ? `#${me.number}` : "—"],
                ["Grupos", me.groups.join(", ") || "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="mt-1 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted">Posição, número, função e grupos são definidos pela comissão.</p>
          </Card>
          <Card title="Segurança">
            <form onSubmit={savePassword} className="space-y-3">
              <input className="input" type="password" required autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} placeholder="Senha atual" />
              <input className="input" type="password" required autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="Nova senha (mínimo de 8 caracteres)" />
              <input className="input" type="password" required autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} placeholder="Repita a nova senha" />
              <ErrorText>{pwAction.error}</ErrorText>
              <Button type="submit" disabled={pwAction.busy}>
                {savedPw ? "Senha alterada" : "Alterar senha"}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
