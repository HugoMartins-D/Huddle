import { memo, useCallback, useEffect, useState } from "react";
import { GridLayout, LiveKitRoom, MediaDeviceMenu, ParticipantTile, RoomAudioRenderer, TrackToggle, useRoomContext, useTracks } from "@livekit/components-react";
import { Track, type Room } from "livekit-client";
import "@livekit/components-styles";
import { Loader2, VideoOff } from "lucide-react";
import { api } from "../lib/store";
import type { Meeting, Member } from "../lib/types";
import { Button } from "./ui";

/** Endereço do servidor LiveKit. Em produção vem de VITE_LIVEKIT_URL (wss://… — o mesmo endereço da API, que repassa /rtc). */
const LIVEKIT_URL = (import.meta.env.VITE_LIVEKIT_URL as string | undefined) ?? `ws://${location.hostname}:7880`;

/*
 * Com `turn.external_tls`, o LiveKit sempre anuncia o TURN em `turns:<domínio>:443`.
 * No ZimaOS a 443 é de outro serviço e o Funnel expõe o TURN na 10000, então o
 * navegador precisa trocar a porta antes de conectar (as credenciais continuam as do LiveKit).
 */
const TURN_TLS_PORT = (import.meta.env.VITE_TURN_TLS_PORT as string | undefined) ?? (LIVEKIT_URL.startsWith("wss:") ? "10000" : "");

function patchTurnPort() {
  const w = window as typeof window & { __huddleTurnPatched?: boolean };
  if (!TURN_TLS_PORT || TURN_TLS_PORT === "443" || w.__huddleTurnPatched) return;
  w.__huddleTurnPatched = true;
  const host = new URL(LIVEKIT_URL.replace(/^ws/, "http")).hostname;
  const fix = (url: string) => url.replace(`turns:${host}:443`, `turns:${host}:${TURN_TLS_PORT}`);
  const fixConfig = (config?: RTCConfiguration) =>
    config && { ...config, iceServers: config.iceServers?.map((s) => ({ ...s, urls: Array.isArray(s.urls) ? s.urls.map(fix) : fix(s.urls) })) };
  const Native = window.RTCPeerConnection;
  window.RTCPeerConnection = class extends Native {
    constructor(config?: RTCConfiguration) {
      super(fixConfig(config));
    }
    setConfiguration(config?: RTCConfiguration) {
      return super.setConfiguration(fixConfig(config));
    }
  };
}
patchTurnPort();

/** O servidor confere se a pessoa pode entrar nesta reunião antes de liberar o token. */
async function fetchToken(meeting: Meeting) {
  const { token } = await api.livekitToken(meeting.id);
  if (!token) throw new Error("Não foi possível obter acesso à sala de vídeo.");
  return token;
}

/** Entrega a sala conectada para quem está fora do LiveKitRoom (a gravação). */
function RoomBridge({ onRoom }: { onRoom: (room: Room | null) => void }) {
  const room = useRoomContext();
  useEffect(() => {
    onRoom(room);
    return () => onRoom(null);
  }, [room]);
  return null;
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

const ignoreDeviceFailure = () => undefined;

const DEVICE_ERRORS = ["NotFoundError", "NotAllowedError", "NotReadableError", "OverconstrainedError", "SecurityError", "AbortError"];

function isDeviceError(e: Error) {
  return DEVICE_ERRORS.includes(e.name) || /requested device|permission denied|could not start (video|audio) source/i.test(e.message);
}

function deviceMessage(e: Error) {
  if (e.name === "NotAllowedError" || e.name === "SecurityError" || /permission/i.test(e.message))
    return "O navegador bloqueou a câmera ou o microfone. Libere no cadeado ao lado do endereço do site e use os controles abaixo.";
  if (e.name === "NotReadableError" || /could not start/i.test(e.message))
    return "A câmera ou o microfone está em uso por outro programa. Feche-o e ligue de novo pelos controles abaixo.";
  return "Nenhuma câmera (ou microfone) encontrada. Você está na sala com o que estiver disponível.";
}

export const VideoStage = memo(function VideoStage({
  meeting,
  me,
  withCamera,
  withMic,
  onRoom,
}: {
  meeting: Meeting;
  me: Member;
  withCamera: boolean;
  withMic: boolean;
  onRoom?: (room: Room | null) => void;
}) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState("");
  // O LiveKitRoom reconecta sempre que onError muda; precisa ser estável (a sala re-renderiza a cada segundo).
  // Ele também usa onError para falhas de câmera/microfone: essas viram só um aviso, sem derrubar a sala.
  const onError = useCallback((e: Error) => {
    if (isDeviceError(e)) return setNotice(deviceMessage(e));
    if (/client initiated/i.test(e.message)) return; // desconexão nossa (saída da tela)
    setError(/pc connection/i.test(e.message) ? "A sala abriu, mas o áudio e o vídeo não conseguiram conectar (rede ou servidor TURN)." : e.message);
  }, []);

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
      style={{ height: "100%", background: "transparent", position: "relative" }}
      onError={onError}
      onMediaDeviceFailure={ignoreDeviceFailure}
    >
      {onRoom && <RoomBridge onRoom={onRoom} />}
      {notice && (
        <div className="absolute inset-x-3 top-3 z-10 flex items-start gap-2 rounded-xl border border-warn/40 bg-black/70 px-3.5 py-2.5 text-xs text-ink backdrop-blur">
          <span className="flex-1">{notice}</span>
          <button type="button" className="text-muted hover:text-ink" onClick={() => setNotice("")} aria-label="Fechar aviso">
            ✕
          </button>
        </div>
      )}
      <Grid />
      <RoomAudioRenderer />
      <Controls />
    </LiveKitRoom>
  );
});
