import { ReactNode } from "react";
import { Bell, BookOpen, CalendarDays, CheckSquare, Clapperboard, Home, LogOut, LucideIcon, PenTool, Settings, ShieldCheck, User, Users } from "lucide-react";
import { api } from "../lib/store";
import { Link, go } from "../lib/router";
import { unreadCount } from "../lib/selectors";
import type { Data, Member, Team } from "../lib/types";
import { Avatar, Crest, ICON } from "./ui";

type NavItem = { key: string; label: string; short?: string; to: string; icon: LucideIcon; soon?: boolean };

const COMMISSION_NAV: NavItem[] = [
  { key: "inicio", label: "Início", to: "/inicio", icon: Home },
  { key: "reunioes", label: "Reuniões", to: "/reunioes", icon: CalendarDays },
  { key: "tarefas", label: "Próximos passos", short: "Tarefas", to: "/tarefas", icon: CheckSquare },
  { key: "gravacoes", label: "Gravações", to: "/gravacoes", icon: Clapperboard },
  { key: "lousa", label: "Lousa tática", to: "/lousa", icon: PenTool },
  { key: "playbook", label: "Playbook", to: "/playbook", icon: BookOpen },
  { key: "elenco", label: "Elenco", to: "/elenco", icon: Users },
  { key: "time", label: "Time", to: "/time", icon: Settings },
];

const ATHLETE_NAV: NavItem[] = [
  { key: "inicio", label: "Início", to: "/inicio", icon: Home },
  { key: "reunioes", label: "Reuniões", to: "/reunioes", icon: CalendarDays },
  { key: "tarefas", label: "Próximos passos", short: "Tarefas", to: "/tarefas", icon: CheckSquare },
  { key: "gravacoes", label: "Gravações", to: "/gravacoes", icon: Clapperboard },
  { key: "playbook", label: "Playbook", to: "/playbook", icon: BookOpen },
  { key: "notificacoes", label: "Notificações", short: "Avisos", to: "/notificacoes", icon: Bell },
  { key: "perfil", label: "Meu perfil", short: "Perfil", to: "/perfil", icon: User },
];

const COMMISSION_TABS = ["inicio", "reunioes", "tarefas", "elenco", "time"];
const ATHLETE_TABS = ["inicio", "reunioes", "tarefas", "notificacoes", "perfil"];

const PLATFORM_ITEM: NavItem = { key: "plataforma", label: "Plataforma", to: "/plataforma", icon: ShieldCheck };

export function AppShell({ data, me, team, active, isAdmin, children }: { data: Data; me: Member; team: Team; active: string; isAdmin: boolean; children: ReactNode }) {
  const nav = [...(me.role === "commission" ? COMMISSION_NAV : ATHLETE_NAV), ...(isAdmin ? [PLATFORM_ITEM] : [])];
  const tabs = (me.role === "commission" ? COMMISSION_TABS : ATHLETE_TABS).map((k) => nav.find((n) => n.key === k)!);
  const unread = unreadCount(data, me);

  return (
    <div className="min-h-screen lg:pl-[232px]">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-line bg-surface lg:flex">
        <Link to="/inicio" className="flex items-center gap-3 px-5 pt-6 pb-7">
          <Crest team={team} size={40} />
          <span className="min-w-0">
            <span className="display block truncate text-[17px] uppercase leading-tight">{team.name}</span>
            {team.sport && <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{team.sport}</span>}
          </span>
        </Link>
        <span className="eyebrow px-5 pb-2">{me.role === "commission" ? "Comissão técnica" : "Área do atleta"}</span>
        <nav className="flex flex-col gap-0.5 px-3">
          {nav.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className={`flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                active === item.key ? "bg-accent/15 text-ink ring-1 ring-accent/40" : item.soon ? "text-muted/60 hover:text-muted" : "text-muted hover:bg-surface-3 hover:text-ink"
              }`}
            >
              <item.icon {...ICON} className={active === item.key ? "text-accent" : ""} />
              <span className="flex-1">{item.label}</span>
              {item.soon && <span className="text-[10px] font-semibold uppercase tracking-wide">em breve</span>}
              {item.key === "notificacoes" && unread > 0 && <span className="chip bg-accent text-on-accent">{unread}</span>}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-line p-3">
          <div className="flex items-center gap-3 rounded-xl p-2">
            <Link to="/perfil" className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={me.name} size={36} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{me.name}</span>
                <span className="block truncate text-xs text-muted">{me.title}</span>
              </span>
            </Link>
            <button type="button" title="Sair" onClick={() => { api.logout(); go("/login"); }} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink">
              <LogOut {...ICON} size={16} />
            </button>
          </div>
          <p className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/70">Plataforma HUDDLE</p>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur md:px-8">
        <Link to="/inicio" className="flex min-w-0 items-center gap-2.5 lg:hidden">
          <Crest team={team} size={32} />
          <span className="display truncate text-[15px] uppercase">{team.name}</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {isAdmin && (
            <Link to="/plataforma" title="Plataforma" className="grid size-10 place-items-center rounded-xl border border-line-2 bg-surface-2 text-muted hover:text-ink lg:hidden">
              <ShieldCheck {...ICON} />
            </Link>
          )}
          <Link to="/notificacoes" title="Notificações" className="relative grid size-10 place-items-center rounded-xl border border-line-2 bg-surface-2 text-muted hover:text-ink">
            <Bell {...ICON} />
            {unread > 0 && <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent">{unread}</span>}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] px-4 pt-6 pb-28 md:px-8 lg:pb-12">{children}</main>

      {/* Tab bar mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {tabs.map((item) => (
          <Link key={item.key} to={item.to} className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${active === item.key ? "text-accent" : "text-muted"}`}>
            <item.icon {...ICON} size={20} />
            {item.short ?? item.label}
            {item.key === "notificacoes" && unread > 0 && <span className="absolute top-1.5 left-1/2 ml-2 size-2 rounded-full bg-accent" />}
          </Link>
        ))}
      </nav>
    </div>
  );
}
