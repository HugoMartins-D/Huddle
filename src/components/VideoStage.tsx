import { useEffect, useState } from "react";
import { GridLayout, LiveKitRoom, MediaDeviceMenu, ParticipantTile, RoomAudioRenderer, TrackToggle, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";
import { Loader2, VideoOff } from "lucide-react";
import { api } from "../lib/store";
import type { Meeting, Member } from "../lib/types";
import { Button } from "./ui";

/** Endereço do servidor LiveKit. Em produção vem de VITE_LIVEKIT_URL (wss://… — o mesmo endereço da API, que repassa /rtc). */
const LIVEKIT_URL = (import.meta.env.VITE_LIVEKIT_URL as string | undefined) ?? `ws://${location.hostname}:7880`;

/** O servidor confere se a pessoa pode entrar nesta reunião antes de liberar o token. */
async function fetchToken(meeting: Meeting) {
  const { token } = await api.livekitToken(meeting.id);
  if (!token) throw new Error("Não foi possível obter acesso à sala de vídeo.");
  return token;
}

function Grid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  return (
    <GridLayout tracks={tracks} style={{ height: "calc(100% - 64px)" }}>
      <ParticipantTile />
    </GridLayout>
  );
}

/** Barra de controles do LiveKit com rótulos em português. */
function Controls() {
  return (
    <div className="lk-control-bar">
      <div className="lk-button-group">
        <TrackToggle source={Track.Source.Microphone}>Microfone</TrackToggle>
        <div className="lk-button-group-menu">
          <MediaDeviceMenu kind="audioinput" />
        </div>
      </div>
      <div className="lk-button-group">
        <TrackToggle source={Track.Source.Camera}>Câmera</TrackToggle>
        <div className="lk-button-group-menu">
          <MediaDeviceMenu kind="videoinput" />
        </div>
      </div>
      <TrackToggle source={Track.Source.ScreenShare} captureOptions={{ audio: true, selfBrowserSurface: "include" }}>
        Compartilhar tela
      </TrackToggle>
    </div>
  );
}

export function VideoStage({ meeting, me, withCamera, withMic }: { meeting: Meeting; me: Member; withCamera: boolean; withMic: boolean }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError("");
    fetchToken(meeting)
      .then((t) => !cancelled && setToken(t))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [meeting.id, me.id, attempt]);

  if (error) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <VideoOff className="mx-auto mb-3 text-muted" size={28} strokeWidth={1.8} />
          <p className="font-bold">Vídeo indisponível</p>
          <p className="mt-1 max-w-sm text-sm text-muted">{error} Verifique se o servidor de vídeo está rodando.</p>
          <Button small className="mt-4" onClick={() => setAttempt((n) => n + 1)}>
            Tentar de novo
          </Button>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="animate-spin" size={16} /> Conectando ao vídeo…
        </span>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL}
      token={token}
      connect
      video={withCamera}
      audio={withMic}
      data-lk-theme="default"
      style={{ height: "100%", background: "transparent" }}
      onError={(e) => setError(e.message)}
      onMediaDeviceFailure={() => undefined}
    >
      <Grid />
      <RoomAudioRenderer />
      <Controls />
    </LiveKitRoom>
  );
}
