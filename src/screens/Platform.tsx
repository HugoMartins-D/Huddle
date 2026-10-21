import { useEffect, useState } from "react";
import { LogIn, Search, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, Crest, Empty, ErrorText, PageHeader, useAction } from "../components/ui";
import { fmtDateTime, plural } from "../lib/format";
import { go } from "../lib/router";
import { api, type PlatformTeam } from "../lib/store";
import type { Team } from "../lib/types";

/** Administração da plataforma: todos os times, com entrada direta em qualquer um. */
export function Platform({ team }: { team: Team }) {
  const [teams, setTeams] = useState<PlatformTeam[] | null>(null);
  const [q, setQ] = useState("");
  const [entering, setEntering] = useState("");
  const { error, setError, run } = useAction();

  useEffect(() => {
    api.platformTeams().then(setTeams, (e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const filtered = (teams ?? [])
    .filter((t) => !q || `${t.name} ${t.sport}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  async function enter(teamId: string) {
    setEntering(teamId);
    if (await run(() => api.enterTeam(teamId))) go("/inicio");
    setEntering("");
  }

  return (
    <>
      <PageHeader
        eyebrow="Administração HUDDLE"
        title="Plataforma"
        subtitle={teams ? plural(teams.length, "time cadastrado", "times cadastrados") : "Carregando times…"}
      />
      <ErrorText>{error}</ErrorText>
      <Card padded={false}>
        <div className="border-b border-line p-4">
          <label className="relative block">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input className="input pl-9" placeholder="Buscar time ou modalidade" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        {teams && !filtered.length ? (
          <Empty icon={ShieldCheck} title="Nenhum time encontrado" text={q ? "Tente outro nome." : "Ainda não há times cadastrados na plataforma."} />
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-4 p-4">
                <span style={{ ["--accent" as string]: t.color || undefined, ["--on-accent" as string]: "#fff" }}>
                  <Crest team={t} size={44} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    <span className="truncate">{t.name}</span>
                    {t.id === team.id && <Badge tone="accent">Você está aqui</Badge>}
                  </p>
                  <p className="text-xs text-muted">
                    {[t.sport, plural(t.members, "pessoa", "pessoas"), plural(t.meetings, "reunião", "reuniões"), `desde ${fmtDateTime(t.createdAt)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Button small variant={t.id === team.id ? "secondary" : "primary"} icon={LogIn} disabled={t.id === team.id || Boolean(entering)} onClick={() => enter(t.id)}>
                  {entering === t.id ? "Entrando…" : "Entrar"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
