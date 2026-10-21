/*
 * Gravação da sala pelo navegador da comissão. Grava só o que está sendo
 * transmitido: as câmeras e telas compartilhadas da sala (montadas num canvas)
 * e o áudio de todos os participantes — sem o restante do painel do HUDDLE.
 * Cada troca de item da pauta vira um capítulo.
 */
import { useEffect, useRef, useState } from "react";
import { Track, type Participant, type Room } from "livekit-client";
import { api } from "./store";
import type { Chapter, Meeting } from "./types";

type State = "idle" | "starting" | "recording" | "saving";

const MIME_TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
const W = 1280;
const H = 720;
const FPS = 30;
const GAP = 8;

// ---------- composição do vídeo ----------

type Tile = { name: string; video?: HTMLVideoElement; fit: "cover" | "contain" };

/** Um <video> fora da página para cada faixa de vídeo da sala (criado uma vez, reaproveitado). */
function videoFor(cache: Map<string, HTMLVideoElement>, track: MediaStreamTrack) {
  let el = cache.get(track.id);
  if (!el) {
    el = document.createElement("video");
    el.muted = true;
    el.playsInline = true;
    el.srcObject = new MediaStream([track]);
    el.play().catch(() => undefined);
    cache.set(track.id, el);
  }
  return el;
}

function liveTrack(p: Participant, source: Track.Source) {
  const pub = p.getTrackPublication(source);
  const track = pub && !pub.isMuted ? pub.track?.mediaStreamTrack : undefined;
  return track && track.readyState === "live" ? track : undefined;
}

function tilesOf(room: Room, cache: Map<string, HTMLVideoElement>) {
  const participants: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()];
  const screens: Tile[] = [];
  const cameras: Tile[] = [];
  for (const p of participants) {
    const name = p.name || p.identity;
    const screen = liveTrack(p, Track.Source.ScreenShare);
    if (screen) screens.push({ name: `Tela de ${name}`, video: videoFor(cache, screen), fit: "contain" });
    const camera = liveTrack(p, Track.Source.Camera);
    cameras.push({ name, video: camera && videoFor(cache, camera), fit: "cover" });
  }
  return { screens, cameras };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawTile(ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number, w: number, h: number) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 12);
  ctx.fillStyle = "#1a1f24";
  ctx.fill();
  ctx.clip();
  const v = tile.video;
  if (v && v.videoWidth) {
    const scale = tile.fit === "cover" ? Math.max(w / v.videoWidth, h / v.videoHeight) : Math.min(w / v.videoWidth, h / v.videoHeight);
    const dw = v.videoWidth * scale;
    const dh = v.videoHeight * scale;
    ctx.drawImage(v, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  } else {
    // câmera desligada: iniciais no centro
    const initials = tile.name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("");
    const r = Math.min(w, h) * 0.18;
    ctx.fillStyle = "#2a3138";
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c9d1d9";
    ctx.font = `700 ${Math.round(r * 0.8)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials || "?", x + w / 2, y + h / 2);
  }
  // nome
  const size = Math.max(12, Math.min(18, Math.round(h / 14)));
  ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const label = tile.name.length > 40 ? `${tile.name.slice(0, 39)}…` : tile.name;
  const tw = ctx.measureText(label).width;
  roundRect(ctx, x + 8, y + h - size - 18, tw + 16, size + 10, 6);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, x + 16, y + h - size / 2 - 13);
  ctx.restore();
}

/** Grade de quadros 16:9 que melhor aproveita a área. */
function drawGrid(ctx: CanvasRenderingContext2D, tiles: Tile[], x: number, y: number, w: number, h: number) {
  const n = tiles.length;
  if (!n) return;
  let best = { cols: 1, tw: 0, th: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    let tw = (w - GAP * (cols - 1)) / cols;
    let th = (tw * 9) / 16;
    if (th * rows + GAP * (rows - 1) > h) {
      th = (h - GAP * (rows - 1)) / rows;
      tw = (th * 16) / 9;
    }
    if (tw * th > best.tw * best.th) best = { cols, tw, th };
  }
  const rows = Math.ceil(n / best.cols);
  const gridH = rows * best.th + (rows - 1) * GAP;
  tiles.forEach((tile, i) => {
    const row = Math.floor(i / best.cols);
    const inRow = Math.min(best.cols, n - row * best.cols);
    const rowW = inRow * best.tw + (inRow - 1) * GAP;
    const col = i % best.cols;
    drawTile(ctx, tile, x + (w - rowW) / 2 + col * (best.tw + GAP), y + (h - gridH) / 2 + row * (best.th + GAP), best.tw, best.th);
  });
}

function drawFrame(ctx: CanvasRenderingContext2D, room: Room, cache: Map<string, HTMLVideoElement>) {
  ctx.fillStyle = "#0b0f0d";
  ctx.fillRect(0, 0, W, H);
  const { screens, cameras } = tilesOf(room, cache);
  if (screens.length) {
    // tela compartilhada em destaque, câmeras numa coluna à direita
    const side = cameras.length ? 260 : 0;
    drawTile(ctx, screens[0], GAP, GAP, W - side - GAP * (side ? 3 : 2), H - GAP * 2);
    if (side) {
      const th = Math.min((side * 9) / 16, (H - GAP * (cameras.length + 1)) / cameras.length);
      const visible = cameras.slice(0, Math.floor((H - GAP) / (th + GAP)));
      const top = (H - visible.length * th - (visible.length - 1) * GAP) / 2;
      visible.forEach((tile, i) => drawTile(ctx, tile, W - side - GAP, top + i * (th + GAP), side, th));
    }
  } else {
    drawGrid(ctx, cameras, GAP, GAP, W - GAP * 2, H - GAP * 2);
  }
}

// ---------- mistura do áudio ----------

/** Liga ao mixer cada áudio que aparece na sala e desliga os que somem. */
function syncAudio(room: Room, ctx: AudioContext, mix: MediaStreamAudioDestinationNode, sources: Map<string, MediaStreamAudioSourceNode>) {
  const participants: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()];
  const live = new Set<string>();
  for (const p of participants) {
    for (const source of [Track.Source.Microphone, Track.Source.ScreenShareAudio]) {
      const track = p.getTrackPublication(source)?.track?.mediaStreamTrack;
      if (!track || track.readyState !== "live") continue;
      live.add(track.id);
      if (!sources.has(track.id)) {
        const node = ctx.createMediaStreamSource(new MediaStream([track]));
        node.connect(mix);
        sources.set(track.id, node);
      }
    }
  }
  for (const [id, node] of sources) {
    if (live.has(id)) continue;
    node.disconnect();
    sources.delete(id);
  }
}

/**
 * Relógio da gravação num Worker: timers da página ficam lentos quando a aba vai
 * para segundo plano, e a gravação congelaria.
 */
function startTicker(fn: () => void) {
  const url = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${Math.round(1000 / FPS)});`], { type: "text/javascript" }));
  const worker = new Worker(url);
  worker.onmessage = fn;
  return () => {
    worker.terminate();
    URL.revokeObjectURL(url);
  };
}

// ---------- hook ----------

export function useRecorder(meeting: Meeting, room: Room | null) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const ref = useRef<{
    recorder: MediaRecorder;
    chunks: Blob[];
    chapters: Chapter[];
    startedAt: number;
    cleanup: () => void;
    done: Promise<void>;
  } | null>(null);

  const itemTitle = meeting.agenda[meeting.currentItem]?.title;

  // Cada troca de item da pauta durante a gravação vira um capítulo.
  useEffect(() => {
    const r = ref.current;
    if (!r || state !== "recording" || !itemTitle) return;
    const t = (Date.now() - r.startedAt) / 1000;
    if (r.chapters[r.chapters.length - 1]?.title !== itemTitle) r.chapters.push({ t, title: itemTitle });
  }, [itemTitle, state]);

  async function start() {
    setError("");
    if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
      setError("Este navegador não permite gravar. Use Chrome ou Edge no computador.");
      return;
    }
    if (!room || room.state !== "connected") {
      setError("Espere o vídeo da sala conectar para começar a gravar.");
      return;
    }
    setState("starting");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const g = canvas.getContext("2d")!;
      const videos = new Map<string, HTMLVideoElement>();
      const audio = new AudioContext();
      await audio.resume();
      const mix = audio.createMediaStreamDestination();
      const sources = new Map<string, MediaStreamAudioSourceNode>();

      const tick = () => {
        drawFrame(g, room, videos);
        syncAudio(room, audio, mix, sources);
      };
      tick();
      const stopTicker = startTicker(tick);

      const stream = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...mix.stream.getAudioTracks()]);
      const mimeType = MIME_TYPES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      const recorder = new MediaRecorder(stream, { mimeType: mimeType || undefined, videoBitsPerSecond: 2_500_000 });
      const chunks: Blob[] = [];
      const begin = Date.now();
      const chapters: Chapter[] = [{ t: 0, title: itemTitle ?? "Início" }];
      let resolveDone!: () => void;
      const done = new Promise<void>((r) => (resolveDone = r));

      const cleanup = () => {
        stopTicker();
        stream.getTracks().forEach((t) => t.stop());
        for (const v of videos.values()) v.srcObject = null;
        audio.close().catch(() => undefined);
      };

      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = async () => {
        cleanup();
        setState("saving");
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "video/webm" });
          await api.saveRecording({ meetingId: meeting.id, durationSec: (Date.now() - begin) / 1000, mimeType: blob.type, chapters }, blob);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Não foi possível salvar a gravação.");
        } finally {
          ref.current = null;
          setState("idle");
          resolveDone();
        }
      };

      recorder.start(1000);
      ref.current = { recorder, chunks, chapters, startedAt: begin, cleanup, done };
      setStartedAt(begin);
      setState("recording");
    } catch (e) {
      setState("idle");
      setError(e instanceof Error ? e.message : "Não foi possível iniciar a gravação.");
    }
  }

  /** Para e salva. Resolve quando a gravação estiver guardada. */
  async function stop() {
    const r = ref.current;
    if (!r) return;
    if (r.recorder.state !== "inactive") r.recorder.stop();
    await r.done;
  }

  // Saiu da tela gravando: salva o que já foi gravado.
  useEffect(() => () => {
    const r = ref.current;
    if (r && r.recorder.state !== "inactive") r.recorder.stop();
  }, []);

  return { state, error, startedAt, start, stop };
}
