import { ReactNode } from "react";
import { CalendarDays, CheckSquare, Video } from "lucide-react";
import { ICON } from "./ui";

/** Telas de acesso usam a marca HUDDLE (azul-marinho e dourado), não a cor do time. */
export function AccessLayout({ children }: { children: ReactNode }) {
  return (
    <div className="hud min-h-screen bg-hud-bg text-ink lg:grid lg:grid-cols-[1fr_minmax(440px,560px)]">
      <aside className="relative hidden overflow-hidden border-r border-hud-line lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(245,184,61,0.14),transparent_45%),radial-gradient(circle_at_90%_90%,rgba(62,123,250,0.12),transparent_50%)]" />
        <Brand />
        <div className="relative max-w-lg">
          <p className="mb-4 text-[11px] font-bold tracking-[0.14em] text-hud-gold uppercase">Time alinhado. Próxima jogada.</p>
          <h2 className="display text-6xl leading-[0.95] uppercase">
            Alinhar
            <br />
            rápido.
            <br />
            Jogar junto.
          </h2>
          <p className="mt-6 max-w-md text-muted">A plataforma conecta. O time dá a identidade.</p>
          <div className="mt-8 flex flex-wrap gap-2">
            {[
              [Video, "Reuniões ao vivo"],
              [CheckSquare, "Decisões e tarefas"],
              [CalendarDays, "Agenda do time"],
            ].map(([Icon, label]) => {
              const I = Icon as typeof Video;
              return (
                <span key={label as string} className="inline-flex items-center gap-2 rounded-full border border-hud-line bg-hud-surface px-3.5 py-2 text-xs font-medium">
                  <I {...ICON} size={15} className="text-hud-gold" /> {label as string}
                </span>
              );
            })}
          </div>
        </div>
        <p className="relative text-xs text-muted">Acesso exclusivo por convite do seu time.</p>
      </aside>
      <main className="flex min-h-screen flex-col px-5 py-8 sm:px-10 lg:justify-center lg:bg-hud-surface/40">
        <div className="mb-10 lg:hidden">
          <Brand />
        </div>
        <div className="mx-auto w-full max-w-[420px]">{children}</div>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <div className="relative flex items-center gap-3">
      <img src="/assets/114ed.svg" alt="" className="size-10" />
      <div>
        <strong className="display block text-2xl leading-none">HUDDLE</strong>
        <span className="text-[10px] font-semibold tracking-[0.16em] text-muted uppercase">Plataforma do seu time</span>
      </div>
    </div>
  );
}

export function TestModeNote() {
  return (
    <p className="mt-8 rounded-xl border border-hud-line bg-hud-surface px-3.5 py-3 text-xs leading-relaxed text-muted">
      <strong className="text-hud-gold">Modo de teste local.</strong> Os dados ficam salvos só neste navegador e nenhum e-mail é enviado ainda.
    </p>
  );
}
