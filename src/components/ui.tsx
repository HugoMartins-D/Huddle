import { ButtonHTMLAttributes, ReactNode, useState } from "react";
import { ArrowLeft, Check, Copy, LucideIcon } from "lucide-react";
import { initials } from "../lib/format";
import { go } from "../lib/router";
import type { Team } from "../lib/types";

export const ICON = { size: 18, strokeWidth: 1.8 } as const;

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  small,
  icon: Icon,
  className = "",
  children,
  ...props
}: { variant?: Variant; small?: boolean; icon?: LucideIcon } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`btn btn-${variant} ${small ? "btn-sm" : ""} ${className}`} {...props}>
      {Icon && <Icon {...ICON} size={small ? 16 : 18} />}
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{children}</p>;
}

export function Card({ title, action, children, className = "", padded = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={`card ${padded ? "p-5" : ""} ${className}`}>
      {(title || action) && (
        <header className={`mb-4 flex items-center justify-between gap-3 ${padded ? "" : "px-5 pt-5"}`}>
          {title && <h2 className="text-[15px] font-bold">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

type Tone = "accent" | "muted" | "warn" | "danger" | "live";

const TONES: Record<Tone, string> = {
  accent: "bg-accent/15 text-accent",
  muted: "bg-surface-3 text-muted",
  warn: "bg-warn/15 text-warn",
  danger: "bg-danger/15 text-danger",
  live: "bg-danger text-white",
};

export function Badge({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`chip ${TONES[tone]}`}>{children}</span>;
}

export function Empty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-surface-3 text-accent">
        <Icon {...ICON} size={22} />
      </div>
      <p className="font-bold">{title}</p>
      {text && <p className="mt-1.5 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Avatar({ name, size = 36, muted }: { name: string; size?: number; muted?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-bold ${muted ? "bg-surface-3 text-muted" : "bg-accent/20 text-accent"}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Crest({ team, size = 40 }: { team: Pick<Team, "name" | "crest">; size?: number }) {
  if (team.crest) return <img src={team.crest} alt="" className="shrink-0 rounded-xl object-contain" style={{ width: size, height: size }} />;
  return (
    <span className="grid shrink-0 place-items-center rounded-xl bg-accent font-black italic text-on-accent" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials(team.name || "?")}
    </span>
  );
}

export function PageHeader({ title, subtitle, back, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; back?: string; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <button type="button" onClick={() => go(back)} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft {...ICON} size={16} /> Voltar
          </button>
        )}
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="display text-[26px] leading-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line-2 bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`h-9 rounded-lg px-3.5 text-[13px] font-semibold transition-colors ${value === o.value ? "bg-accent text-on-accent" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-surface-3 border border-line-2"}`}>
        <span className={`absolute top-1/2 size-[18px] -translate-y-1/2 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-[3px]"}`} />
        <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      </span>
    </label>
  );
}

export function CheckRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
      <span className={`grid size-5 shrink-0 place-items-center rounded-md border ${checked ? "border-accent bg-accent text-on-accent" : "border-line-2 bg-surface-2"}`}>
        {checked && <Check size={14} strokeWidth={3} />}
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

export function CopyButton({ text, label = "Copiar link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      small
      icon={done ? Check : Copy}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          window.prompt("Copie o link:", text);
        }
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      {done ? "Copiado" : label}
    </Button>
  );
}

/** Executa uma ação assíncrona controlando carregamento e erro. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(fn: () => Promise<unknown> | unknown) {
    setBusy(true);
    setError("");
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo deu errado.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, setError, run };
}
