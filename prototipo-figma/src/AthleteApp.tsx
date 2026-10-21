import { FormEvent } from "react";

type AthleteRoute =
  | "athlete-home"
  | "athlete-notifications"
  | "athlete-meetings"
  | "athlete-meetings-empty"
  | "athlete-meeting-detail"
  | "athlete-present"
  | "athlete-absent"
  | "athlete-lobby"
  | "athlete-live"
  | "athlete-chat"
  | "athlete-summary"
  | "athlete-summary-read"
  | "athlete-recordings"
  | "athlete-watch"
  | "athlete-playbook"
  | "athlete-play-detail"
  | "athlete-tasks"
  | "athlete-task-detail"
  | "athlete-task-done"
  | "athlete-profile"
  | "athlete-edit-profile"
  | "athlete-profile-updated";

const athleteScreens: { id: AthleteRoute; label: string }[] = [
  { id: "athlete-home", label: "Início" },
  { id: "athlete-notifications", label: "Notificações" },
  { id: "athlete-meetings", label: "Suas reuniões" },
  { id: "athlete-meetings-empty", label: "Agenda vazia" },
  { id: "athlete-meeting-detail", label: "Detalhe da reunião" },
  { id: "athlete-present", label: "Presença confirmada" },
  { id: "athlete-absent", label: "Ausência informada" },
  { id: "athlete-lobby", label: "Antes de entrar" },
  { id: "athlete-live", label: "Sala ao vivo" },
  { id: "athlete-chat", label: "Chat da reunião" },
  { id: "athlete-summary", label: "Resumo da reunião" },
  { id: "athlete-summary-read", label: "Ciência confirmada" },
  { id: "athlete-recordings", label: "Gravações" },
  { id: "athlete-watch", label: "Assistir gravação" },
  { id: "athlete-playbook", label: "Playbook" },
  { id: "athlete-play-detail", label: "Detalhe da jogada" },
  { id: "athlete-tasks", label: "Próximos passos" },
  { id: "athlete-task-detail", label: "Detalhe da tarefa" },
  { id: "athlete-task-done", label: "Tarefa concluída" },
  { id: "athlete-profile", label: "Meu perfil" },
  { id: "athlete-edit-profile", label: "Editar meus dados" },
  { id: "athlete-profile-updated", label: "Dados atualizados" },
];

const nav = [
  ["Início", "athlete-home"],
  ["Reuniões", "athlete-meetings"],
  ["Gravações", "athlete-recordings"],
  ["Playbook", "athlete-playbook"],
  ["Meus próximos passos", "athlete-tasks"],
  ["Notificações", "athlete-notifications"],
  ["Meu perfil", "athlete-profile"],
] as const;

const routeSection = (route: string) => {
  if (route.includes("notification")) return "Notificações";
  if (
    route.includes("meeting") ||
    route.includes("present") ||
    route.includes("absent") ||
    route.includes("lobby") ||
    route.includes("live") ||
    route.includes("chat") ||
    route.includes("summary")
  )
    return "Reuniões";
  if (route.includes("record") || route.includes("watch")) return "Gravações";
  if (route.includes("play")) return "Playbook";
  if (route.includes("task")) return "Meus próximos passos";
  if (route.includes("profile")) return "Meu perfil";
  return "Início";
};

const titles: Record<AthleteRoute, [string, string]> = {
  "athlete-home": ["Bom dia, Rafa", "Sua equipe está alinhando a próxima jogada."],
  "athlete-notifications": ["Notificações", "Almirantes · Temporada 2026 · Área do atleta"],
  "athlete-meetings": ["Suas reuniões", "Almirantes · Temporada 2026 · Área do atleta"],
  "athlete-meetings-empty": ["Suas reuniões", "Almirantes · Temporada 2026 · Área do atleta"],
  "athlete-meeting-detail": ["Huddle de ataque", "Hoje · 20:00–20:10 · Online"],
  "athlete-present": ["Presença confirmada", "Almirantes · Temporada 2026 · Área do atleta"],
  "athlete-absent": ["Ausência informada", "Almirantes · Temporada 2026 · Área do atleta"],
  "athlete-lobby": ["Prepare sua entrada", "Huddle de ataque · Sua câmera e seu microfone"],
  "athlete-live": ["Huddle de ataque · Ao vivo", "REC 12:04 · 7 participantes · André Luz apresentando"],
  "athlete-chat": ["Chat da reunião", "Huddle de ataque · Sala exclusiva dos convidados"],
  "athlete-summary": ["Resumo da reunião", "Publicado por André Luz · Hoje, 20:45"],
  "athlete-summary-read": ["Resumo da reunião", "Publicado por André Luz · Hoje, 20:45"],
  "athlete-recordings": ["Gravações", "Biblioteca liberada para seu perfil e unidade"],
  "athlete-watch": ["Tática de ataque", "Gravação · Hoje · Duração 41:12"],
  "athlete-playbook": ["Playbook da minha unidade", "Consulta das jogadas publicadas pela comissão"],
  "athlete-play-detail": ["#14 · Slant Flood", "Ataque · Trips Right · Versão publicada"],
  "athlete-tasks": ["Meus próximos passos", "Acordos e tarefas atribuídos a você"],
  "athlete-task-detail": ["Detalhe da tarefa", "Almirantes · Temporada 2026 · Área do atleta"],
  "athlete-task-done": ["Tarefa concluída", "Almirantes · Temporada 2026 · Área do atleta"],
  "athlete-profile": ["Meu perfil", "Almirantes · Temporada 2026 · Área do atleta"],
  "athlete-edit-profile": ["Editar meus dados", "Almirantes · Temporada 2026 · Área do atleta"],
  "athlete-profile-updated": ["Dados atualizados", "Almirantes · Temporada 2026 · Área do atleta"],
};

function Sidebar({
  route,
  go,
}: {
  route: AthleteRoute;
  go: (route: string) => void;
}) {
  const active = routeSection(route);
  return (
    <aside className="athlete-sidebar">
      <div className="team-lockup">
        <img src="/assets/88a42.svg" alt="" />
        <div>
          <strong>ALMIRANTES</strong>
          <span>FLAG FOOTBALL</span>
        </div>
      </div>
      <span className="sidebar-label">ÁREA DO ATLETA</span>
      <nav>
        {nav.map(([label, destination]) => (
          <button
            type="button"
            className={active === label ? "active" : ""}
            key={label}
            onClick={() => go(destination)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="athlete-identity">
        <strong>RS&nbsp;&nbsp; Rafael Souza</strong>
        <span>#12 · WR · Ataque</span>
        <small>PLATAFORMA HUDDLE</small>
      </div>
    </aside>
  );
}

function Card({
  eyebrow,
  title,
  text,
  onClick,
  outlined = false,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  onClick?: () => void;
  outlined?: boolean;
}) {
  const content = (
    <>
      {eyebrow && <span>{eyebrow}</span>}
      <strong>{title}</strong>
      {text && <p>{text}</p>}
    </>
  );
  return onClick ? (
    <button type="button" className={`athlete-card ${outlined ? "outlined" : ""}`} onClick={onClick}>
      {content}
    </button>
  ) : (
    <article className={`athlete-card ${outlined ? "outlined" : ""}`}>{content}</article>
  );
}

function Action({
  children,
  onClick,
  primary = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
}) {
  return (
    <button type="button" className={`athlete-action ${primary ? "primary" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function TwoColumns({
  main,
  side,
}: {
  main: React.ReactNode;
  side: React.ReactNode;
}) {
  return (
    <div className="athlete-columns">
      <section className="athlete-main-column">{main}</section>
      <aside className="athlete-side-column">{side}</aside>
    </div>
  );
}

function Confirmation({
  kicker = "ALMIRANTES / HUDDLE",
  title,
  text,
  onContinue,
}: {
  kicker?: string;
  title: string;
  text: string;
  onContinue: () => void;
}) {
  return (
    <section className="confirmation-panel">
      <span>{kicker}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      <Action primary onClick={onContinue}>
        Continuar
      </Action>
    </section>
  );
}

const meetingCards = [
  ["HOJE · 20:00–20:10", "Huddle de ataque", "Ataque · Online · Responder presença"],
  ["SEX · 20:00–20:45", "Treino mental — WRs", "WR · Online · Confirmado"],
  ["TER · 20:30–21:15", "Revisão de jogo", "Time todo · Online · Responder presença"],
];

const decisions = [
  ["01 / RED ZONE", "Slant Flood como jogada principal", "Aplicar a leitura combinada no próximo treino."],
  ["02 / COVER 2", "Bola no slant antes de 3 segundos", "Ajustar tempo entre QB e recebedores."],
  ["03 / ESCALAÇÃO", "Bia titular no slot", "Decisão publicada pela comissão."],
];

function Board({ live = false }: { live?: boolean }) {
  return (
    <div className="play-board">
      <img src={`/assets/${live ? "219b3" : "6bb9c"}.svg`} alt="Diagrama da jogada Slant Flood" />
    </div>
  );
}

function ScreenContent({
  route,
  go,
}: {
  route: AthleteRoute;
  go: (route: string) => void;
}) {
  if (route === "athlete-home") {
    return (
      <TwoColumns
        main={
          <>
            <section className="hero-meeting">
              <span>HOJE · 20:00 · HUDDLE DE 10 MIN</span>
              <h2>JUNTE O TIME.<br />ALINHE A PRÓXIMA JOGADA.</h2>
              <p>Leitura do QB, ajustes de rota e próximos passos.</p>
              <Action primary onClick={() => go("athlete-meeting-detail")}>Entrar na reunião</Action>
            </section>
            <h3>Suas pendências</h3>
            <Card eyebrow="RESUMO PARA LER" title="Tática de ataque — vs. Tubarões" text="Confirme ciência das decisões publicadas para você." onClick={() => go("athlete-summary")} />
            <Card eyebrow="TAREFA · ATÉ 24 OUT" title="Rever vídeo do adversário" text="Próximo passo atribuído a Rafael Souza." onClick={() => go("athlete-task-detail")} />
          </>
        }
        side={
          <>
            <h3>Próximas reuniões</h3>
            <Card eyebrow="SEX · 20:00" title="Treino mental — WRs" text="Presença confirmada · 45 min" />
            <Card eyebrow="TER · 20:30" title="Revisão de jogo" text="Presença pendente · Time todo" />
            <h3>Acesso rápido</h3>
            <Action onClick={() => go("athlete-playbook")}>Playbook da minha unidade</Action>
            <Action onClick={() => go("athlete-tasks")}>Meus próximos passos</Action>
            <p className="helper">Você acompanha somente os materiais e convites destinados ao seu perfil.</p>
          </>
        }
      />
    );
  }

  if (route === "athlete-notifications") {
    return (
      <TwoColumns
        main={
          <>
            <Card eyebrow="RESUMO · NÃO LIDO" title="Você tem decisões para ler" text="Tática de ataque · Confirmar ciência" onClick={() => go("athlete-summary")} />
            <Card eyebrow="TAREFA · NOVA" title="Rever vídeo do adversário" text="Atribuída por André Luz · Até 24 out" onClick={() => go("athlete-task-detail")} />
            <Card eyebrow="REUNIÃO · CONVITE" title="Huddle de ataque" text="Hoje, 20:00 · Responder presença" onClick={() => go("athlete-meeting-detail")} />
          </>
        }
        side={
          <>
            <Card eyebrow="SEU TIME, SEM RUÍDO" title="Avisos que importam" text="Convites, decisões e tarefas relacionadas a você." />
            <Action>Marcar avisos como lidos</Action>
          </>
        }
      />
    );
  }

  if (route === "athlete-meetings") {
    return (
      <TwoColumns
        main={
          <>
            <div className="tabs">Próximas&nbsp; / &nbsp;Anteriores</div>
            {meetingCards.map(([eyebrow, title, text]) => (
              <Card key={title} eyebrow={eyebrow} title={title} text={text} onClick={() => go("athlete-meeting-detail")} />
            ))}
          </>
        }
        side={
          <>
            <Card eyebrow="OUTUBRO 2026" title="Sua agenda do time" text={"16 · Huddle de ataque\n23 · Treino mental — WRs\n27 · Revisão de jogo"} />
            <h3>Convites direcionados</h3>
            <p className="helper large">A lista mostra apenas reuniões para as quais você foi convidado. Confirme sua presença para ajudar a comissão.</p>
          </>
        }
      />
    );
  }

  if (route === "athlete-meetings-empty") {
    return (
      <section className="confirmation-panel">
        <span>SUA AGENDA ESTÁ EM DIA</span>
        <h2>O próximo huddle aparece aqui.</h2>
        <p>Você ainda não tem reuniões futuras. Os convites da comissão serão exibidos nesta lista.</p>
        <Action primary onClick={() => go("athlete-playbook")}>Consultar materiais do time</Action>
        <Action onClick={() => go("athlete-meetings")}>Ver reuniões anteriores</Action>
      </section>
    );
  }

  if (route === "athlete-meeting-detail") {
    return (
      <TwoColumns
        main={
          <>
            <h2 className="content-title">Uma pauta. Dez minutos. Todo mundo alinhado.</h2>
            <Card eyebrow="CONDUÇÃO" title="André Luz · Head Coach" text="Reunião para a unidade de ataque" />
            <h3>Pauta do huddle</h3>
            <Card eyebrow="01 · 3 MIN" title="Alinhar a leitura do QB" text="O que precisamos observar antes do snap?" />
            <Card eyebrow="02 · 4 MIN" title="Resolver dúvidas de rota" text="Timing da quebra e ajuste contra Cover 2" />
            <Card eyebrow="03 · 3 MIN" title="Definir próximos passos" text="Responsáveis e orientação para o próximo treino" />
          </>
        }
        side={
          <>
            <Card eyebrow="SUA RESPOSTA" title="Presença pendente" text="Confirme se você pode participar." />
            <Action primary onClick={() => go("athlete-present")}>Vou participar</Action>
            <Action onClick={() => go("athlete-absent")}>Não vou participar</Action>
            <Action onClick={() => go("athlete-lobby")}>Preparar entrada na sala</Action>
            <Card eyebrow="MATERIAL ANEXADO" title="#14 Slant Flood" text="Jogada publicada · Somente consulta" onClick={() => go("athlete-play-detail")} />
          </>
        }
      />
    );
  }

  if (route === "athlete-present")
    return <Confirmation title="Presença confirmada" text="Você confirmou sua participação no huddle. Pode alterar sua resposta no detalhe da reunião." onContinue={() => go("athlete-meeting-detail")} />;
  if (route === "athlete-absent")
    return <Confirmation title="Ausência informada" text="Sua resposta foi registrada. O resumo ficará disponível se a comissão liberar para você." onContinue={() => go("athlete-meetings")} />;

  if (route === "athlete-lobby") {
    return (
      <TwoColumns
        main={
          <>
            <div className="camera-preview"><strong>RS</strong><span>Rafael Souza · câmera desligada</span></div>
            <div className="media-actions"><Action>Microfone desligado</Action><Action>Câmera desligada</Action></div>
          </>
        }
        side={
          <>
            <Card eyebrow="ANTES DE ENTRAR" title="A reunião será gravada" text="A comissão define o público autorizado para assistir depois." />
            <Action primary onClick={() => go("athlete-live")}>Entrar na reunião</Action>
            <p className="helper large">Permissão bloqueada? Habilite câmera e microfone nas configurações do navegador.</p>
          </>
        }
      />
    );
  }

  if (route === "athlete-live") {
    return (
      <TwoColumns
        main={
          <>
            <Board live />
            <div className="four-actions"><Action>Mic</Action><Action>Câmera</Action><Action>Levantar mão</Action><Action onClick={() => go("athlete-summary")}>Sair</Action></div>
            <p className="helper">Esta reunião está sendo gravada.</p>
          </>
        }
        side={
          <>
            <Card eyebrow="PAUTA · ITEM 2 DE 3" title="Timing do QB" text="03:48 restantes neste item" />
            <h3>Chat da reunião</h3>
            <Card eyebrow="ANDRÉ · 20:02" title="Vamos alinhar a leitura do slant." text="Comissão técnica" />
            <Card eyebrow="RAFAEL · VOCÊ · 20:03" title="Posso confirmar o timing?" text="Enviada" />
            <Action onClick={() => go("athlete-chat")}>Abrir chat</Action>
          </>
        }
      />
    );
  }

  if (route === "athlete-chat") {
    return (
      <TwoColumns
        main={
          <>
            <Card eyebrow="ANDRÉ LUZ · 20:02" title="Vamos alinhar a leitura do slant." text="Mensagem para todos na sala" />
            <Card eyebrow="RAFAEL · VOCÊ · 20:03" title="Posso confirmar o timing da quebra?" text="Enviada" />
            <Card eyebrow="ANDRÉ LUZ · 20:04" title="Sim, vamos revisar a jogada na lousa." text="Mensagem para todos na sala" />
            <label className="athlete-field">Mensagem para a sala<input placeholder="Escreva sua mensagem..." /></label>
            <Action primary>Enviar mensagem</Action>
          </>
        }
        side={
          <>
            <Card eyebrow="PAUTA EM DISCUSSÃO" title="Timing do QB" text="Acompanhe a apresentação sem perder a conversa." />
            <Action onClick={() => go("athlete-live")}>Voltar à apresentação</Action>
            <p className="helper large">Encerrar a reunião para todos é uma ação exclusiva do condutor.</p>
          </>
        }
      />
    );
  }

  if (route === "athlete-summary" || route === "athlete-summary-read") {
    const read = route.endsWith("-read");
    return (
      <TwoColumns
        main={
          <>
            <h2 className="content-title">Tática de ataque — vs. Tubarões</h2>
            <h3>Decisões do time</h3>
            {decisions.map(([eyebrow, title, text]) => <Card key={title} eyebrow={eyebrow} title={title} text={text} />)}
          </>
        }
        side={
          <>
            <Card outlined={read} eyebrow="SEU PRÓXIMO PASSO" title="Rever vídeo do adversário" text="Até sáb, 24 out · Atribuída a você" onClick={() => go("athlete-task-detail")} />
            <Action primary onClick={() => go("athlete-summary-read")}>{read ? "✓  Ciência confirmada" : "Estou ciente"}</Action>
            <Action onClick={() => go("athlete-watch")}>Assistir gravação · 41:12</Action>
            <p className="helper">{read ? "Sua leitura foi confirmada. Veja seu próximo passo." : "Sua confirmação de leitura será visível para a comissão."}</p>
          </>
        }
      />
    );
  }

  if (route === "athlete-recordings" || route === "athlete-playbook") {
    const playbook = route === "athlete-playbook";
    const items = playbook
      ? [["#14 · TRIPS RIGHT", "Slant Flood"], ["#09 · SPREAD", "Mesh concept"], ["#22 · RED ZONE", "Corner / Flat"], ["#31 · DOUBLES", "Quick Out"], ["#18 · SPREAD", "Levels"], ["#27 · BUNCH", "Snag"]]
      : [["41 MIN · COM RESUMO", "Tática de ataque"], ["48 MIN · PLAYBOOK", "Red zone: leitura do QB"], ["35 MIN · SCOUT", "Análise do adversário"], ["41 MIN · COM RESUMO", "Revisão da rodada"], ["48 MIN · PLAYBOOK", "Timing dos recebedores"], ["35 MIN · SCOUT", "Preparação pré-jogo"]];
    return (
      <>
        <label className="athlete-field">{playbook ? "Buscar jogada" : "Buscar gravação"}<input placeholder={playbook ? "Nome, formação ou número" : "Buscar por título, assunto ou reunião"} /></label>
        <div className="tabs">{playbook ? "Ataque  /  Todas as formações  /  Publicadas" : "Todas  /  Ataque  /  Defesa  /  Marcadas por mim"}</div>
        <div className="library-grid">
          {items.map(([eyebrow, title]) => (
            <Card key={title} eyebrow={eyebrow} title={title} text={playbook ? "Ver desenho e orientação do coach" : "Material liberado pela comissão · Assistir"} onClick={() => go(playbook ? "athlete-play-detail" : "athlete-watch")} />
          ))}
        </div>
        <p className="helper">{playbook ? "Somente leitura · Criação e edição de jogadas ficam com a comissão técnica." : "O atleta consulta gravações autorizadas. Gestão de armazenamento e publicação ficam com a comissão."}</p>
      </>
    );
  }

  if (route === "athlete-watch") {
    const chapters = [["00:00", "Abertura e objetivo", "Introdução do coach"], ["04:12", "Slant Flood x Cover 2", "Leitura do QB"], ["19:35", "Timing do QB", "Ajustes de execução"], ["34:08", "Decisões e próximos passos", "Fechamento do huddle"]];
    return (
      <TwoColumns
        main={<><Board /><div className="player-line">▶&nbsp; 00:00 / 41:12&nbsp;&nbsp;&nbsp;&nbsp; 1×&nbsp;&nbsp;&nbsp;&nbsp; Tela cheia</div><Action primary onClick={() => go("athlete-summary")}>Ler resumo da reunião</Action></>}
        side={<><h3>Capítulos</h3>{chapters.map(([a,b,c]) => <Card key={a} eyebrow={a} title={b} text={c} />)}</>}
      />
    );
  }

  if (route === "athlete-play-detail") {
    return (
      <TwoColumns
        main={<><Board /><h3>Sua função · WR</h3><p className="body-copy">Ataque o espaço interno e ajuste a quebra à leitura do QB. Observe a alavanca do defensor antes do snap.</p></>}
        side={<><Card eyebrow="ORIENTAÇÃO DO COACH" title="Contra Cover 2" text="A bola deve sair no slant antes de 3 segundos." /><Card eyebrow="MATERIAL DO TIME" title="Jogada publicada" text="Última revisão: André Luz · Head Coach" /><Action onClick={() => go("athlete-playbook")}>Voltar ao playbook</Action></>}
      />
    );
  }

  if (route === "athlete-tasks") {
    return (
      <TwoColumns
        main={<><div className="tabs">Pendentes (2)&nbsp; / &nbsp;Concluídos</div><Card eyebrow="ATÉ SÁB, 24 OUT" title="Rever vídeo do adversário" text="Revisão — Rodada 5 · Atribuída a você" onClick={() => go("athlete-task-detail")} /><Card eyebrow="ATÉ SEX, 23 OUT" title="Revisar Slant Flood" text="Huddle de ataque · Atribuída a você" onClick={() => go("athlete-task-detail")} /></>}
        side={<><Card eyebrow="FOCO INDIVIDUAL" title="Só os seus próximos passos" text="Você conclui suas tarefas. A comissão acompanha o andamento." /><Action onClick={() => go("athlete-playbook")}>Consultar playbook</Action></>}
      />
    );
  }

  if (route === "athlete-task-detail") {
    return (
      <TwoColumns
        main={<><span className="green-kicker">PENDENTE · ATÉ SÁB, 24 OUT</span><h2 className="detail-title">Rever vídeo do adversário</h2><p className="body-copy">Revise as saídas e mudanças de direção do WR #12. Leve suas dúvidas para o próximo huddle.</p><Card eyebrow="RESPONSÁVEL" title="Rafael Souza · #12 · WR" text="Atribuída por André Luz · Revisão — Rodada 5" /><Action primary onClick={() => go("athlete-task-done")}>Marcar como concluída</Action></>}
        side={<><Card eyebrow="MATERIAL VINCULADO" title="Análise do adversário" text="Gravação · 35 min" /><Action onClick={() => go("athlete-watch")}>Abrir gravação</Action></>}
      />
    );
  }

  if (route === "athlete-task-done")
    return <Confirmation title="Tarefa concluída" text="Seu próximo passo foi concluído. A comissão verá a atualização." onContinue={() => go("athlete-tasks")} />;

  if (route === "athlete-profile") {
    return (
      <TwoColumns
        main={<section className="profile-card"><strong className="profile-avatar">RS</strong><h2>Rafael Souza</h2><b>ATLETA · #12 · WR · ATAQUE</b><p>Almirantes Flag Football · Temporada 2026</p><Action primary onClick={() => go("athlete-edit-profile")}>Editar meus dados</Action></section>}
        side={<><Card eyebrow="SEU ACESSO" title="Atleta" text="Posição, número e função são definidos pela comissão." /><Action onClick={() => go("athlete-tasks")}>Meus próximos passos</Action><Action>Segurança e acesso</Action><Action onClick={() => go("login")}>Sair da conta</Action></>}
      />
    );
  }

  if (route === "athlete-edit-profile") {
    const submit = (event: FormEvent) => { event.preventDefault(); go("athlete-profile-updated"); };
    return (
      <TwoColumns
        main={<form className="profile-form" onSubmit={submit}><label className="athlete-field">Nome de exibição<input defaultValue="Rafael Souza" /></label><label className="athlete-field">Telefone<input defaultValue="(47) 99999-0000" /></label><label className="athlete-field">E-mail de acesso · somente leitura<input defaultValue="rafael.souza@gmail.com" readOnly /></label><p className="helper">Alterações do e-mail de acesso dependem da comissão.</p><div className="form-buttons"><button className="athlete-action primary" type="submit">Salvar alterações</button><Action onClick={() => go("athlete-profile")}>Cancelar</Action></div></form>}
        side={<><Card eyebrow="DADOS DO TIME · SOMENTE LEITURA" title="#12 · WR · Ataque" text="Posição, número, unidade e permissões são definidos pela comissão." /><Card eyebrow="IDENTIDADE DO TIME" title="Almirantes" text="Escudo, cores e nome vêm do time ao qual você pertence." /></>}
      />
    );
  }

  return <Confirmation title="Dados atualizados" text="Suas alterações foram salvas. Os dados do time continuam sob gestão da comissão." onContinue={() => go("athlete-profile")} />;
}

export default function AthleteApp({
  route,
  go,
}: {
  route: string;
  go: (route: string) => void;
}) {
  const current = (athleteScreens.some((item) => item.id === route) ? route : "athlete-home") as AthleteRoute;
  const [title, subtitle] = titles[current];
  const navigate = (next: string) => {
    window.location.hash = next;
    go(next);
  };

  return (
    <div className="athlete-shell">
      <Sidebar route={current} go={navigate} />
      <main className="athlete-page">
        <header className="athlete-header">
          <div><h1>{title}</h1><p>{subtitle}</p></div>
          <span>ALMIRANTES&nbsp; / &nbsp;RS</span>
        </header>
        <div className="athlete-content"><ScreenContent route={current} go={navigate} /></div>
      </main>
      <label className="athlete-screen-picker">
        <span>Tela</span>
        <select value={current} onChange={(event) => navigate(event.target.value)}>
          {athleteScreens.map((item, index) => <option value={item.id} key={item.id}>{index + 1}. {item.label}</option>)}
        </select>
      </label>
    </div>
  );
}
