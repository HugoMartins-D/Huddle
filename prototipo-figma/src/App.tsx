import { FormEvent, useEffect, useState } from "react";
import AthleteApp from "./AthleteApp";
import CommissionApp from "./CommissionApp";

const assets = "/assets";

type Screen =
  | "login"
  | "activate"
  | "recover"
  | "reset"
  | "expired"
  | "email"
  | "sent"
  | `athlete-${string}`
  | `commission-${string}`;

const screens: { id: Screen; label: string }[] = [
  { id: "login", label: "Login" },
  { id: "activate", label: "Ativar conta" },
  { id: "recover", label: "Recuperar acesso" },
  { id: "reset", label: "Redefinir senha" },
  { id: "expired", label: "Convite expirado" },
  { id: "email", label: "Confira seu e-mail" },
  { id: "sent", label: "Solicitação enviada" },
];

function BrandPanel({ detailed = false }: { detailed?: boolean }) {
  if (detailed) {
    return (
      <aside className="login-brand">
        <img className="field-art" src={`${assets}/200ca.svg`} alt="" />
        <div className="brand-gradient" />
        <div className="brand-lockup">
          <img src={`${assets}/114ed.svg`} alt="" />
          <div>
            <strong>HUDDLE</strong>
            <span>PLATAFORMA DO SEU TIME</span>
          </div>
        </div>
        <div className="login-pitch">
          <span className="eyebrow">TIME ALINHADO. PRÓXIMA JOGADA.</span>
          <h2>
            ALINHAR
            <br />
            RÁPIDO.
            <br />
            JOGAR JUNTO.
          </h2>
          <p>
            Reuniões ao vivo, playbook e gravações. O encontro é curto. O time
            sai mais forte.
          </p>
          <div className="features">
            <span>
              <img src={`${assets}/51827.svg`} alt="" /> Reuniões ao vivo
            </span>
            <span>
              <img src={`${assets}/9b2a1.svg`} alt="" /> Gravações
            </span>
            <span>
              <img src={`${assets}/fb212.svg`} alt="" /> Playbook
            </span>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="brand-panel">
      <strong className="brand-name">HUDDLE</strong>
      <h2>
        ALINHAR
        <br />
        RÁPIDO.
        <br />
        JOGAR JUNTO.
      </h2>
      <p>
        A plataforma conecta.
        <br />O time dá a identidade.
      </p>
      <small>Reuniões · Playbook · Decisões · Próximos passos</small>
    </aside>
  );
}

function Field({
  label,
  value,
  placeholder,
  type = "text",
  readOnly = false,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        defaultValue={value}
        placeholder={placeholder}
        readOnly={readOnly}
      />
    </label>
  );
}

function PrimaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button className="primary-button" type={onClick ? "button" : "submit"} onClick={onClick}>
      {children}
    </button>
  );
}

function SimpleLayout({
  title,
  description,
  children,
  onBack,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <>
      <BrandPanel />
      <main className="simple-main">
        <section className="simple-form">
          <span className="area-label">ÁREA DO ATLETA</span>
          <h1>{title}</h1>
          <p className="description">{description}</p>
          {children}
          <button className="text-link" type="button" onClick={onBack}>
            Já tem acesso? Voltar ao login
          </button>
        </section>
      </main>
    </>
  );
}

function Login({ go }: { go: (screen: Screen) => void }) {
  function submit(event: FormEvent) {
    event.preventDefault();
    go("athlete-home");
  }

  return (
    <>
      <BrandPanel detailed />
      <main className="login-main">
        <form className="login-form" onSubmit={submit}>
          <div className="area-heading">
            <img src={`${assets}/fa114.svg`} alt="" />
            <span>ÁREA DO ATLETA</span>
          </div>
          <h1>Entrar na sua conta</h1>
          <p className="login-description">
            Use o e-mail cadastrado pela comissão técnica do seu time.
          </p>

          <label className="login-field active">
            <span>E-mail ou celular</span>
            <div>
              <img src={`${assets}/b6d87.svg`} alt="" />
              <input defaultValue="hugo.martins@almirantes.com" />
            </div>
          </label>
          <label className="login-field">
            <span>Senha</span>
            <div>
              <img src={`${assets}/1d9ba.svg`} alt="" />
              <input type="password" defaultValue="jogarjunto" />
              <img src={`${assets}/d2c71.svg`} alt="" />
            </div>
          </label>

          <div className="login-options">
            <label>
              <span className="checkbox">
                <img src={`${assets}/01514.svg`} alt="" />
              </span>
              Manter conectado
            </label>
            <button type="button" onClick={() => go("recover")}>
              Esqueci a senha
            </button>
          </div>

          <button className="login-primary" type="submit">
            <img src={`${assets}/50f44.svg`} alt="" /> Entrar
          </button>
          <div className="divider">
            <span /> primeiro acesso? <span />
          </div>
          <button className="invite-button" type="button" onClick={() => go("activate")}>
            <img src={`${assets}/f97f6.svg`} alt="" /> Ativar convite com código
          </button>
          <div className="info-card">
            <img src={`${assets}/d4c06.svg`} alt="" />
            <p>
              Atletas não criam conta sozinhos. A <strong>comissão técnica</strong>{" "}
              cadastra você e envia um convite por e-mail.
            </p>
          </div>
          <button className="register" type="button" onClick={() => go("commission-register")}>
            É da comissão e quer montar seu time? <strong>Registrar time</strong>
          </button>
        </form>
      </main>
    </>
  );
}

function App() {
  const initialHash = window.location.hash.slice(1) as Screen;
  const [screen, setScreen] = useState<Screen>(
    screens.some((item) => item.id === initialHash) ||
      initialHash.startsWith("athlete-") ||
      initialHash.startsWith("commission-")
      ? initialHash
      : "login",
  );

  const go = (next: Screen) => {
    setScreen(next);
    window.location.hash = next;
  };

  useEffect(() => {
    const onHashChange = () => {
      const next = window.location.hash.slice(1) as Screen;
      if (
        screens.some((item) => item.id === next) ||
        next.startsWith("athlete-") ||
        next.startsWith("commission-")
      )
        setScreen(next);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const back = () => go("login");

  if (screen.startsWith("athlete-")) {
    return <AthleteApp route={screen} go={(next) => go(next as Screen)} />;
  }

  if (screen.startsWith("commission-")) {
    return <CommissionApp route={screen} go={(next) => go(next as Screen)} />;
  }

  let content: React.ReactNode;
  if (screen === "login") {
    content = <Login go={go} />;
  } else if (screen === "activate") {
    content = (
      <SimpleLayout
        title="Ative sua conta"
        description="Você foi convidado para os Almirantes por André Luz. Crie sua senha para entrar no painel do seu time."
        onBack={back}
      >
        <form className="flow-form" onSubmit={(event) => { event.preventDefault(); go("login"); }}>
          <div className="team-card">
            <img src={`${assets}/c94ad.svg`} alt="Almirantes" />
            <strong>ALMIRANTES · FLAG FOOTBALL</strong>
          </div>
          <Field label="Nome" value="Rafael Souza" />
          <Field
            label="E-mail do convite · somente leitura"
            value="rafael.souza@gmail.com"
            readOnly
          />
          <Field label="Crie uma senha" placeholder="Pelo menos 8 caracteres" type="password" />
          <p className="terms">
            Ao ativar sua conta, você concorda com os termos e com a política de
            privacidade da plataforma.
          </p>
          <PrimaryButton>Ativar conta</PrimaryButton>
        </form>
      </SimpleLayout>
    );
  } else if (screen === "recover") {
    content = (
      <SimpleLayout
        title="Recuperar acesso"
        description="Informe o e-mail do seu convite. Se houver uma conta cadastrada, você receberá as instruções."
        onBack={back}
      >
        <form className="flow-form" onSubmit={(event) => { event.preventDefault(); go("email"); }}>
          <Field label="E-mail" value="rafael.souza@gmail.com" type="email" />
          <PrimaryButton>Enviar instruções</PrimaryButton>
        </form>
      </SimpleLayout>
    );
  } else if (screen === "reset") {
    content = (
      <SimpleLayout
        title="Redefinir senha"
        description="Crie uma senha exclusiva para a sua conta. As duas senhas precisam ser iguais."
        onBack={back}
      >
        <form className="flow-form" onSubmit={(event) => { event.preventDefault(); go("login"); }}>
          <Field label="Nova senha" placeholder="Pelo menos 8 caracteres" type="password" />
          <Field label="Confirme a senha" placeholder="Repita sua nova senha" type="password" />
          <PrimaryButton>Salvar nova senha</PrimaryButton>
        </form>
      </SimpleLayout>
    );
  } else if (screen === "expired") {
    content = (
      <SimpleLayout
        title="Convite expirado"
        description="Este link perdeu a validade. Peça um novo convite à comissão técnica do seu time."
        onBack={back}
      >
        <form className="flow-form" onSubmit={(event) => { event.preventDefault(); go("sent"); }}>
          <Field label="E-mail do convite" value="rafael.souza@gmail.com" type="email" />
          <PrimaryButton>Solicitar novo convite</PrimaryButton>
        </form>
      </SimpleLayout>
    );
  } else if (screen === "email") {
    content = (
      <SimpleLayout
        title="Confira seu e-mail"
        description="Se houver uma conta com esse e-mail, você receberá instruções para redefinir a senha."
        onBack={back}
      >
        <div className="flow-form">
          <PrimaryButton onClick={back}>Voltar ao login</PrimaryButton>
        </div>
      </SimpleLayout>
    );
  } else {
    content = (
      <SimpleLayout
        title="Solicitação enviada"
        description="A comissão do seu time foi avisada para verificar seu acesso e reenviar o convite."
        onBack={back}
      >
        <div className="flow-form">
          <PrimaryButton onClick={back}>Voltar ao login</PrimaryButton>
        </div>
      </SimpleLayout>
    );
  }

  return (
    <div className={`app-shell ${screen === "login" ? "is-login" : ""}`}>
      {content}
      <nav className="screen-nav" aria-label="Navegação entre telas">
        {screens.map((item, index) => (
          <button
            key={item.id}
            className={screen === item.id ? "selected" : ""}
            type="button"
            onClick={() => go(item.id)}
            aria-label={`${index + 1}. ${item.label}`}
            title={item.label}
          >
            {index + 1}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
