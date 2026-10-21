import { MouseEvent } from "react";
import CommissionHome from "./commission/screen-4-1410";
import NewMeeting from "./commission/screen-4-1899";
import LiveMeeting from "./commission/screen-4-2500";
import CloseMeeting from "./commission/screen-4-3042";
import MeetingSummary from "./commission/screen-4-3428";
import TacticalBoard from "./commission/screen-4-3801";
import Recordings from "./commission/screen-4-4374";
import RecordingPlayer from "./commission/screen-4-4765";
import RegisterTeam from "./commission/screen-4-5198";
import InviteAthlete from "./commission/screen-4-5484";
import Roster from "./commission/screen-4-5874";

type CommissionRoute =
  | "commission-home"
  | "commission-new-meeting"
  | "commission-live"
  | "commission-close"
  | "commission-summary"
  | "commission-board"
  | "commission-recordings"
  | "commission-player"
  | "commission-register"
  | "commission-invite"
  | "commission-roster";

const screens: {
  id: CommissionRoute;
  label: string;
  component: () => React.JSX.Element;
}[] = [
  { id: "commission-home", label: "Início da comissão", component: CommissionHome },
  { id: "commission-new-meeting", label: "Nova reunião", component: NewMeeting },
  { id: "commission-live", label: "Sala ao vivo", component: LiveMeeting },
  { id: "commission-close", label: "Encerrar e publicar", component: CloseMeeting },
  { id: "commission-summary", label: "Resumo e acompanhamento", component: MeetingSummary },
  { id: "commission-board", label: "Lousa tática", component: TacticalBoard },
  { id: "commission-recordings", label: "Gravações", component: Recordings },
  { id: "commission-player", label: "Player da gravação", component: RecordingPlayer },
  { id: "commission-register", label: "Registrar time", component: RegisterTeam },
  { id: "commission-invite", label: "Cadastro e convites", component: InviteAthlete },
  { id: "commission-roster", label: "Elenco", component: Roster },
];

function destinationForText(text: string): CommissionRoute | "login" | null {
  const value = text.replace(/\s+/g, " ").trim();

  if (value.includes("Cadastrar e enviar convite")) return "commission-roster";
  if (value.includes("Convidar atleta")) return "commission-invite";
  if (value.includes("Iniciar reunião agora")) return "commission-live";
  if (value.includes("Publicar resumo para o time") || value === "Publicar resumo")
    return "commission-summary";
  if (value.includes("Assistir gravação")) return "commission-player";
  if (value === "Encerrar" || value.includes("Fechar a reunião")) return "commission-close";
  if (value.includes("Iniciar reunião") || value.includes("Começar uma reunião"))
    return "commission-new-meeting";
  if (value === "Continuar" && window.location.hash === "#commission-register")
    return "commission-invite";

  if (value === "Início") return "commission-home";
  if (value.includes("Sala ao vivo")) return "commission-live";
  if (value.includes("Lousa tática")) return "commission-board";
  if (value === "Gravações") return "commission-recordings";
  if (value === "Elenco") return "commission-roster";
  if (value === "Reuniões") return "commission-new-meeting";
  if (value.includes("Voltar para a sala")) return "commission-live";
  if (value.includes("Voltar")) return "commission-home";
  if (value.includes("Entrar")) return "login";
  return null;
}

export default function CommissionApp({
  route,
  go,
}: {
  route: string;
  go: (route: string) => void;
}) {
  const current =
    screens.find((screen) => screen.id === route) ??
    screens.find((screen) => screen.id === "commission-home")!;
  const CurrentScreen = current.component;

  const navigate = (next: string) => {
    window.location.hash = next;
    go(next);
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const candidates = [
      target.textContent ?? "",
      target.parentElement?.textContent ?? "",
      target.closest("[data-name]")?.textContent ?? "",
    ];
    for (const text of candidates) {
      const destination = destinationForText(text);
      if (destination) {
        navigate(destination);
        return;
      }
    }
  };

  return (
    <div className="commission-shell">
      <div className="commission-canvas" onClick={handleClick}>
        <div className="commission-frame">
          <CurrentScreen />
        </div>
      </div>
      <label className="commission-screen-picker">
        <span>Tela</span>
        <select value={current.id} onChange={(event) => navigate(event.target.value)}>
          {screens.map((screen, index) => (
            <option value={screen.id} key={screen.id}>
              {index + 1}. {screen.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
