/*
 * Gravação da sala pelo navegador da comissão: captura a aba (vídeo + áudio
 * dos participantes) e mistura o microfone de quem grava. Cada troca de item
 * da pauta vira um capítulo.
 */
import { useEffect, useRef, useState } from "react";
import { api } from "./store";
import type { Chapter, Meeting } from "./types";

type State = "idle" | "starting" | "recording" | "saving";

const MIME_TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];

export function useRecorder(meeting: Meeting) {
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
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") {
      setError("Este navegador não permite gravar a tela. Use Chrome ou Edge no computador.");
      return;
    }
    setState("starting");
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
        // Sugere ao navegador capturar a própria aba da reunião.
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        systemAudio: "include",
      } as DisplayMediaStreamOptions);

      const ctx = new AudioContext();
      const mix = ctx.createMediaStreamDestination();
      if (display.getAudioTracks().length) ctx.createMediaStreamSource(new MediaStream(display.getAudioTracks())).connect(mix);
      let mic: MediaStream | null = null;
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        ctx.createMediaStreamSource(mic).connect(mix);
      } catch {
        // sem microfone: grava só o áudio da aba
      }

      const stream = new MediaStream([...display.getVideoTracks(), ...mix.stream.getAudioTracks()]);
      const mimeType = MIME_TYPES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      const recorder = new MediaRecorder(stream, { mimeType: mimeType || undefined, videoBitsPerSecond: 2_500_000 });
      const chunks: Blob[] = [];
      const begin = Date.now();
      const chapters: Chapter[] = [{ t: 0, title: itemTitle ?? "Início" }];
      let resolveDone!: () => void;
      const done = new Promise<void>((r) => (resolveDone = r));

      const cleanup = () => {
        display.getTracks().forEach((t) => t.stop());
        mic?.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => undefined);
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
      // Se a pessoa parar o compartilhamento pela barra do navegador, encerra a gravação.
      display.getVideoTracks()[0]?.addEventListener("ended", () => recorder.state !== "inactive" && recorder.stop());

      recorder.start(1000);
      ref.current = { recorder, chunks, chapters, startedAt: begin, cleanup, done };
      setStartedAt(begin);
      setState("recording");
    } catch (e) {
      setState("idle");
      if (e instanceof DOMException && e.name === "NotAllowedError") setError("Gravação cancelada: a captura da tela não foi permitida.");
      else setError(e instanceof Error ? e.message : "Não foi possível iniciar a gravação.");
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
