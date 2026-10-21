import { ReactNode, useEffect } from "react";
import { Loader2, SearchX } from "lucide-react";
import { AppShell } from "./components/AppShell";
import { Button, Card, Empty } from "./components/ui";
import { go, useRoute } from "./lib/router";
import { useSession } from "./lib/store";
import { applyTeamColor } from "./lib/theme";
import type { Data, Member, Team } from "./lib/types";
import { ActivateInvite, Login, Recover, RegisterTeam } from "./screens/Access";
import { AthleteHome, CommissionHome } from "./screens/Home";
import { LiveRoom } from "./screens/LiveRoom";
import { MeetingDetail, MeetingsList, NewMeeting } from "./screens/Meetings";
import { Notifications, Profile, TaskDetail, TasksList } from "./screens/Personal";
import { RecordingPlayer, RecordingsList } from "./screens/Recordings";
import { CloseMeeting, SummaryView } from "./screens/Summary";
import { BoardEditor, PlayDetail, PlaybookList } from "./screens/Tactics";
import { MemberForm, Roster, TeamSettings } from "./screens/Team";
import { visiblePlays, visibleRecordings } from "./lib/selectors";

const PUBLIC = new Set(["login", "registrar", "convite", "recuperar"]);

function NotFound({ text = "Esta página não existe ou você não tem acesso a ela." }: { text?: string }) {
  return (
    <Card>
      <Empty icon={SearchX} title="Não encontrado" text={text} action={<Button onClick={() => go("/inicio")}>Voltar ao início</Button>} />
    </Card>
  );
}

function routeScreen(segments: string[], data: Data, me: Member, team: Team): { active: string; screen: ReactNode } {
  const [section, id, sub] = segments;
  const isCommission = me.role === "commission";
  const commissionOnly = (screen: ReactNode) => (isCommission ? screen : <NotFound />);

  switch (section) {
    case "inicio":
      return { active: "inicio", screen: isCommission ? <CommissionHome data={data} me={me} team={team} /> : <AthleteHome data={data} me={me} /> };

    case "reunioes": {
      if (!id) return { active: "reunioes", screen: <MeetingsList data={data} me={me} /> };
      if (id === "nova") return { active: "reunioes", screen: commissionOnly(<NewMeeting data={data} me={me} team={team} />) };
      const meeting = data.meetings.find((m) => m.id === id && m.teamId === team.id);
      if (!meeting || (!isCommission && !meeting.invitedIds.includes(me.id))) return { active: "reunioes", screen: <NotFound /> };
      if (sub === "sala") return { active: "reunioes", screen: <LiveRoom data={data} me={me} meeting={meeting} /> };
      if (sub === "encerrar")
        return {
          active: "reunioes",
          screen: commissionOnly(meeting.status === "published" ? <SummaryView data={data} me={me} meeting={meeting} /> : <CloseMeeting key={meeting.id} data={data} me={me} meeting={meeting} />),
        };
      if (sub === "resumo")
        return {
          active: "reunioes",
          screen: meeting.summary ? <SummaryView data={data} me={me} meeting={meeting} /> : <NotFound text="O resumo desta reunião ainda não foi publicado." />,
        };
      return { active: "reunioes", screen: <MeetingDetail data={data} me={me} meeting={meeting} /> };
    }

    case "tarefas": {
      if (!id) return { active: "tarefas", screen: <TasksList data={data} me={me} /> };
      const task = data.tasks.find((t) => t.id === id && t.teamId === team.id);
      if (!task || (!isCommission && task.assigneeId !== me.id)) return { active: "tarefas", screen: <NotFound /> };
      return { active: "tarefas", screen: <TaskDetail data={data} me={me} task={task} /> };
    }

    case "elenco": {
      if (!id) return { active: "elenco", screen: commissionOnly(<Roster data={data} me={me} team={team} />) };
      if (id === "novo") return { active: "elenco", screen: commissionOnly(<MemberForm data={data} me={me} team={team} />) };
      const member = data.members.find((m) => m.id === id && m.teamId === team.id);
      return { active: "elenco", screen: commissionOnly(member ? <MemberForm key={member.id} data={data} me={me} team={team} member={member} /> : <NotFound />) };
    }

    case "gravacoes": {
      if (!id) return { active: "gravacoes", screen: <RecordingsList data={data} me={me} /> };
      const recording = visibleRecordings(data, me).find((r) => r.id === id);
      return { active: "gravacoes", screen: recording ? <RecordingPlayer key={recording.id} data={data} me={me} recording={recording} /> : <NotFound /> };
    }

    case "lousa": {
      const play = id ? data.plays.find((p) => p.id === id && p.teamId === team.id) : undefined;
      if (id && !play) return { active: "lousa", screen: <NotFound /> };
      return { active: "lousa", screen: commissionOnly(<BoardEditor key={play?.id ?? "nova"} team={team} play={play} />) };
    }

    case "playbook": {
      if (!id) return { active: "playbook", screen: <PlaybookList data={data} me={me} team={team} /> };
      const play = visiblePlays(data, me).find((p) => p.id === id);
      return { active: "playbook", screen: play ? <PlayDetail data={data} me={me} play={play} /> : <NotFound /> };
    }

    case "time":
      return { active: "time", screen: commissionOnly(<TeamSettings key={team.id} team={team} />) };
    case "notificacoes":
      return { active: "notificacoes", screen: <Notifications data={data} me={me} /> };
    case "perfil":
      return { active: "perfil", screen: <Profile key={me.id} me={me} team={team} /> };
    default:
      return { active: "", screen: <NotFound /> };
  }
}

export default function App() {
  const segments = useRoute();
  const { data, me, team, loading } = useSession();
  const section = segments[0] ?? "";

  useEffect(() => {
    document.title = team ? `${team.name} · HUDDLE` : "HUDDLE";
    applyTeamColor(team?.color);
  }, [team?.name, team?.color]);

  useEffect(() => {
    if (loading) return;
    if (!section) go(me ? "/inicio" : "/login");
    else if (!me && !PUBLIC.has(section)) go("/login");
    else if (me && (section === "login" || section === "registrar")) go("/inicio");
  }, [section, me, loading]);

  if (section === "convite") return <ActivateInvite key={segments[1]} token={segments[1] ?? ""} />;
  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="animate-spin" size={16} /> Carregando…
        </span>
      </div>
    );
  }
  if (!me || !team) {
    if (section === "registrar") return <RegisterTeam />;
    if (section === "recuperar") return <Recover />;
    return <Login />;
  }

  const { active, screen } = routeScreen(segments, data, me, team);
  return (
    <AppShell data={data} me={me} team={team} active={active}>
      {screen}
    </AppShell>
  );
}
