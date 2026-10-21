import { FormEvent, ReactNode, useEffect, useState } from "react";
import { ArrowLeft, Check, ImagePlus, KeyRound, Link2, Loader2, LogIn, Mail, MailCheck, ShieldCheck, TimerOff } from "lucide-react";
import { AccessLayout } from "../components/AccessLayout";
import { Button, Crest, ErrorText, Field, ICON, useAction } from "../components/ui";
import { api, type InviteInfo } from "../lib/store";
import { Link, go } from "../lib/router";
import { TEAM_COLORS } from "../lib/theme";

const MIN_PASSWORD = 8;

function Heading({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: ReactNode }) {
  return (
    <div className="mb-7">
      {eyebrow && <p className="mb-3 text-[11px] font-bold tracking-[0.12em] text-hud-gold uppercase">{eyebrow}</p>}
      <h1 className="display text-3xl">{title}</h1>
      {text && <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>}
    </div>
  );
}

function BackToLogin() {
  return (
    <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
      <ArrowLeft {...ICON} size={16} /> Voltar ao login
    </Link>
  );
}

function ConsentCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-xl border border-line-2 bg-surface-2 p-3.5 text-xs leading-relaxed text-muted">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
      <span>
        Li e aceito os termos de uso e a política de privacidade. Entendo que as reuniões do time podem ser <strong className="text-ink">gravadas</strong> e que
        a gravação fica disponível só para quem a comissão autorizar (LGPD).
      </span>
    </label>
  );
}

function passwordError(password: string, confirm: string) {
  if (password.length < MIN_PASSWORD) return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
  if (password !== confirm) return "As duas senhas precisam ser iguais.";
  return "";
}

// ---------------- Login ----------------

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState("");
  const { busy, error, run } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await run(() => api.login(email, password))) go("/inicio");
  }

  function openInvite(e: FormEvent) {
    e.preventDefault();
    const code = invite.trim().split("/convite/").pop()?.split(/[?#\s]/)[0];
    if (code) go(`/convite/${code}`);
  }

  return (
    <AccessLayout>
      <Heading eyebrow="Entrar" title="Entrar na sua conta" text="Use o e-mail cadastrado pela comissão técnica do seu time." />
      <form onSubmit={submit} className="space-y-4">
        <Field label="E-mail">
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
        </Field>
        <Field label="Senha">
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" />
        </Field>
        <div className="flex justify-end">
          <Link to="/recuperar" className="text-sm font-medium text-hud-gold hover:underline">
            Esqueci a senha
          </Link>
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" variant="primary" icon={LogIn} disabled={busy} className="w-full">
          Entrar
        </Button>
      </form>

      <div className="my-7 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-hud-line" /> primeiro acesso? <span className="h-px flex-1 bg-hud-line" />
      </div>

      {inviteOpen ? (
        <form onSubmit={openInvite} className="space-y-3">
          <Field label="Link ou código do convite" hint="Você recebe esse link da comissão técnica do seu time.">
            <input className="input" autoFocus value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Cole aqui o link do convite" />
          </Field>
          <Button type="submit" variant="secondary" icon={KeyRound} className="w-full" disabled={!invite.trim()}>
            Abrir convite
          </Button>
        </form>
      ) : (
        <Button icon={Link2} className="w-full" onClick={() => setInviteOpen(true)}>
          Ativar convite
        </Button>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        É da comissão e quer montar seu time?{" "}
        <Link to="/registrar" className="font-semibold text-hud-gold hover:underline">
          Registrar time
        </Link>
      </p>

    </AccessLayout>
  );
}

// ---------------- Registrar time ----------------

export function RegisterTeam() {
  const [step, setStep] = useState<1 | 2>(1);
  const [team, setTeam] = useState({ name: "", sport: "", color: TEAM_COLORS[0].value, crest: "" });
  const [me, setMe] = useState({ name: "", email: "", title: "Presidente", password: "", confirm: "" });
  const [consent, setConsent] = useState(false);
  const { busy, error, setError, run } = useAction();

  function pickCrest(file: File | undefined) {
    if (!file) return;
    if (file.size > 600_000) return setError("Escolha uma imagem de até 600 KB.");
    const reader = new FileReader();
    reader.onload = () => setTeam((t) => ({ ...t, crest: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (step === 1) {
      if (!team.name.trim()) return setError("Informe o nome do time.");
      setError("");
      return setStep(2);
    }
    const pwError = passwordError(me.password, me.confirm);
    if (pwError) return setError(pwError);
    if (!consent) return setError("Para continuar, aceite os termos.");
    const ok = await run(() =>
      api.registerTeam({
        team: { name: team.name.trim(), sport: team.sport.trim(), color: team.color, crest: team.crest || undefined },
        me,
      }),
    );
    if (ok) go("/inicio");
  }

  return (
    <AccessLayout>
      <Heading
        eyebrow={`Passo ${step} de 2`}
        title={step === 1 ? "Registrar seu time" : "Seu acesso"}
        text={
          step === 1
            ? "O escudo e a cor escolhidos aqui viram o tema da plataforma para todo o elenco."
            : "Você será o primeiro membro da comissão técnica. Depois, convide o resto da comissão e os atletas."
        }
      />
      <form onSubmit={submit} className="space-y-5">
        {step === 1 ? (
          <>
            <Field label="Nome do time">
              <input className="input" required autoFocus value={team.name} maxLength={40} onChange={(e) => setTeam({ ...team, name: e.target.value })} />
            </Field>
            <Field label="Modalidade (opcional)" hint="Aparece abaixo do nome do time.">
              <input className="input" value={team.sport} maxLength={30} onChange={(e) => setTeam({ ...team, sport: e.target.value })} placeholder="Ex.: Flag football" />
            </Field>
            <div>
              <span className="label">Escudo (opcional)</span>
              <div className="flex items-center gap-4">
                <div style={{ ["--accent" as string]: team.color, ["--on-accent" as string]: "#fff" }}>
                  <Crest team={{ name: team.name || "?", crest: team.crest }} size={56} />
                </div>
                <label className="btn btn-secondary btn-sm cursor-pointer">
                  <ImagePlus {...ICON} size={16} /> {team.crest ? "Trocar imagem" : "Enviar imagem"}
                  <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="sr-only" onChange={(e) => pickCrest(e.target.files?.[0])} />
                </label>
                {team.crest && (
                  <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => setTeam({ ...team, crest: "" })}>
                    Remover
                  </button>
                )}
              </div>
            </div>
            <div>
              <span className="label">Cor da plataforma</span>
              <div className="flex flex-wrap items-center gap-2.5">
                {TEAM_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.name}
                    onClick={() => setTeam({ ...team, color: c.value })}
                    className={`grid size-9 place-items-center rounded-full ring-offset-2 ring-offset-hud-bg ${team.color === c.value ? "ring-2 ring-white" : ""}`}
                    style={{ background: c.value }}
                  >
                    {team.color === c.value && <Check size={16} strokeWidth={3} color="#fff" />}
                  </button>
                ))}
                <label title="Cor personalizada" className="relative grid size-9 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-line-2 text-xs text-muted">
                  +
                  <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={team.color} onChange={(e) => setTeam({ ...team, color: e.target.value })} />
                </label>
              </div>
            </div>
          </>
        ) : (
          <>
            <Field label="Seu nome completo">
              <input className="input" required autoFocus value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} />
            </Field>
            <Field label="E-mail">
              <input className="input" type="email" required autoComplete="email" value={me.email} onChange={(e) => setMe({ ...me, email: e.target.value })} />
            </Field>
            <Field label="Sua função na comissão">
              <input className="input" required value={me.title} onChange={(e) => setMe({ ...me, title: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Senha">
                <input className="input" type="password" required autoComplete="new-password" value={me.password} onChange={(e) => setMe({ ...me, password: e.target.value })} placeholder={`Mínimo de ${MIN_PASSWORD} caracteres`} />
              </Field>
              <Field label="Confirme a senha">
                <input className="input" type="password" required autoComplete="new-password" value={me.confirm} onChange={(e) => setMe({ ...me, confirm: e.target.value })} />
              </Field>
            </div>
            <ConsentCheck checked={consent} onChange={setConsent} />
          </>
        )}
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-3">
          {step === 2 && (
            <Button onClick={() => setStep(1)} icon={ArrowLeft}>
              Voltar
            </Button>
          )}
          <Button type="submit" variant="primary" className="flex-1" disabled={busy}>
            {step === 1 ? "Continuar" : "Criar time e entrar"}
          </Button>
        </div>
      </form>
      <BackToLogin />
    </AccessLayout>
  );
}

// ---------------- Ativar convite ----------------

export function ActivateInvite({ token }: { token: string }) {
  const [invite, setInvite] = useState<InviteInfo | null | undefined>(undefined);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .findInvite(token)
      .then((info) => !cancelled && setInvite(info))
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loadError) {
    return (
      <AccessLayout>
        <Heading title="Não foi possível abrir o convite" text={loadError} />
        <BackToLogin />
      </AccessLayout>
    );
  }
  if (invite === undefined) {
    return (
      <AccessLayout>
        <p className="inline-flex items-center gap-2 text-sm text-muted">
          <Loader2 className="animate-spin" size={16} /> Abrindo convite…
        </p>
      </AccessLayout>
    );
  }
  return <InviteForm token={token} invite={invite} />;
}

function InviteForm({ token, invite }: { token: string; invite: InviteInfo | null }) {
  const [name, setName] = useState(invite?.member.name ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [requested, setRequested] = useState(false);
  const { busy, error, setError, run } = useAction();

  if (!invite) {
    return (
      <AccessLayout>
        <Heading title="Convite não encontrado" text="Confira se o link está completo ou peça um novo convite à comissão técnica do seu time." />
        <BackToLogin />
      </AccessLayout>
    );
  }

  if (invite.used) {
    return (
      <AccessLayout>
        <Heading title="Convite já usado" text="Sua conta já está ativa. Entre com seu e-mail e senha." />
        <Button variant="primary" className="w-full" onClick={() => go("/login")}>
          Ir para o login
        </Button>
      </AccessLayout>
    );
  }

  if (invite.expired) {
    return (
      <AccessLayout>
        {requested ? (
          <>
            <StateIcon icon={MailCheck} />
            <Heading title="Solicitação enviada" text="A comissão do seu time foi avisada para verificar seu acesso e reenviar o convite." />
          </>
        ) : (
          <>
            <StateIcon icon={TimerOff} tone="warn" />
            <Heading title="Convite expirado" text="Este link perdeu a validade. Peça um novo convite à comissão técnica do seu time." />
            <Button variant="primary" className="w-full" onClick={async () => { await api.requestNewInvite(token); setRequested(true); }}>
              Solicitar novo convite
            </Button>
          </>
        )}
        <BackToLogin />
      </AccessLayout>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const pwError = passwordError(password, confirmPassword);
    if (pwError) return setError(pwError);
    if (!consent) return setError("Para ativar sua conta, aceite os termos.");
    if (await run(() => api.activateInvite(token, { name, password }))) go("/inicio");
  }

  return (
    <AccessLayout>
      {invite.member.status === "active" ? (
        <Heading eyebrow={invite.team?.name} title="Crie uma nova senha" text="A comissão do seu time gerou este link para você voltar a entrar." />
      ) : (
      <Heading
        eyebrow="Você foi convidado"
        title="Ative sua conta"
        text={
          <>
            {invite.invitedBy ? `${invite.invitedBy.name} convidou você` : "Você foi convidado"} para o time <strong className="text-ink">{invite.team?.name}</strong>. Crie
            sua senha para entrar.
          </>
        }
      />
      )}
      {invite.team && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-line-2 bg-surface-2 p-3.5" style={{ ["--accent" as string]: invite.team.color, ["--on-accent" as string]: "#fff" }}>
          <Crest team={invite.team} size={44} />
          <div className="min-w-0">
            <p className="display truncate uppercase">{invite.team.name}</p>
            <p className="text-xs text-muted">
              {invite.member.title}
              {invite.member.position && ` · ${invite.member.position}`}
              {invite.member.number && ` · #${invite.member.number}`}
            </p>
          </div>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome">
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="E-mail do convite · somente leitura">
          <input className="input opacity-70" readOnly value={invite.member.email} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Crie uma senha">
            <input className="input" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={`Mínimo de ${MIN_PASSWORD} caracteres`} />
          </Field>
          <Field label="Confirme a senha">
            <input className="input" type="password" required autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </Field>
        </div>
        <ConsentCheck checked={consent} onChange={setConsent} />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" variant="primary" icon={ShieldCheck} className="w-full" disabled={busy}>
          Ativar conta
        </Button>
      </form>
      <BackToLogin />
    </AccessLayout>
  );
}

// ---------------- Recuperar acesso ----------------

export function Recover() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useAction();

  return (
    <AccessLayout>
      {sent ? (
        <>
          <StateIcon icon={MailCheck} />
          <Heading title="Pedido enviado" text="Se houver uma conta com esse e-mail, a comissão técnica do seu time foi avisada e vai te mandar um link para criar uma nova senha." />
        </>
      ) : (
        <>
          <Heading title="Recuperar acesso" text="Informe o e-mail da sua conta. A comissão técnica do seu time recebe o pedido e te envia um link para criar uma nova senha." />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(() => api.requestPasswordReset(email))) setSent(true);
            }}
            className="space-y-4"
          >
            <Field label="E-mail">
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" variant="primary" icon={Mail} className="w-full" disabled={busy}>
              Pedir nova senha
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted">Não tem mais acesso ao e-mail? Peça ajuda à comissão técnica do seu time.</p>
        </>
      )}
      <BackToLogin />
    </AccessLayout>
  );
}

function StateIcon({ icon: Icon, tone = "accent" }: { icon: typeof Mail; tone?: "accent" | "warn" }) {
  return (
    <div className={`mb-6 grid size-14 place-items-center rounded-2xl ${tone === "warn" ? "bg-warn/15 text-warn" : "bg-accent/15 text-accent"}`}>
      <Icon {...ICON} size={26} />
    </div>
  );
}
