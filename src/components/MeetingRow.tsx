import { ChevronRight } from "lucide-react";
import { fmtDay, fmtTime } from "../lib/format";
import { Link } from "../lib/router";
import { ackAudience, ackOf, audienceLabel, rsvpOf } from "../lib/selectors";
import type { Data, Meeting, Member } from "../lib/types";
import { Badge, ICON } from "./ui";

export function meetingRoute(meeting: Meeting, me: Member) {
  if (meeting.status === "live") return `/reunioes/${meeting.id}/sala`;
  if (meeting.status === "published") return `/reunioes/${meeting.id}/resumo`;
  if (meeting.status === "ended" && me.role === "commission") return `/reunioes/${meeting.id}/encerrar`;
  return `/reunioes/${meeting.id}`;
}

export function MeetingStatusBadge({ data, meeting, me }: { data: Data; meeting: Meeting; me: Member }) {
  if (meeting.status === "live") return <Badge tone="live">● Ao vivo</Badge>;
  if (meeting.status === "ended") return <Badge tone="warn">{me.role === "commission" ? "Publicar resumo" : "Encerrada"}</Badge>;
  if (meeting.status === "published") {
    if (me.role === "commission") {
      const audience = ackAudience(meeting);
      const done = audience.filter((id) => ackOf(data, meeting.id, id)).length;
      return <Badge tone={done === audience.length ? "accent" : "muted"}>{`${done} de ${audience.length} cientes`}</Badge>;
    }
    return ackOf(data, meeting.id, me.id) ? <Badge tone="accent">Ciente</Badge> : <Badge tone="warn">Resumo para ler</Badge>;
  }
  if (me.role === "commission") {
    const going = data.rsvps.filter((r) => r.meetingId === meeting.id && r.going).length;
    return <Badge>{`${going} confirmados`}</Badge>;
  }
  const rsvp = rsvpOf(data, meeting.id, me.id);
  if (!rsvp) return <Badge tone="warn">Responder presença</Badge>;
  return rsvp.going ? <Badge tone="accent">Vou</Badge> : <Badge>Não vou</Badge>;
}

export function MeetingRow({ data, meeting, me }: { data: Data; meeting: Meeting; me: Member }) {
  return (
    <Link to={meetingRoute(meeting, me)} className="group flex items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-surface-2">
      <div className="w-14 shrink-0 text-center">
        <p className="text-[10px] font-bold tracking-wide text-muted uppercase">{fmtDay(meeting.startsAt)}</p>
        <p className="text-[15px] font-black">{fmtTime(meeting.startsAt)}</p>
      </div>
      <span className="h-9 w-0.5 shrink-0 rounded bg-accent/60" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{meeting.title}</p>
        <p className="truncate text-xs text-muted">
          {audienceLabel(meeting)} · {meeting.duration} min
        </p>
      </div>
      <div className="hidden sm:block">
        <MeetingStatusBadge data={data} meeting={meeting} me={me} />
      </div>
      <ChevronRight {...ICON} size={16} className="shrink-0 text-muted group-hover:text-ink" />
    </Link>
  );
}
