import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, Square, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { transcribeVoice } from "@/lib/assistant.functions";
import { VOICE_SECONDS } from "@/lib/assistant-validation";

export function VoiceInput({
  disabled,
  onText,
  onBusy,
}: {
  disabled: boolean;
  onText: (text: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const transcribe = useServerFn(transcribeVoice);
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearInterval(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice recording is unavailable in this browser.");
      return;
    }
    onBusy(true);
    try {
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        audio.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = audio;
      const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      if (!mimeType) throw new Error("Voice recording is unavailable in this browser.");
      const media = new MediaRecorder(audio, { mimeType });
      recorder.current = media;
      const chunks: Blob[] = [];
      media.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      media.onstop = async () => {
        if (timer.current) clearInterval(timer.current);
        audio.getTracks().forEach((t) => t.stop());
        if (!mounted.current) return;
        setState("transcribing");
        try {
          const form = new FormData();
          const ext = mimeType === "audio/mp4" ? "m4a" : mimeType === "audio/ogg" ? "ogg" : "webm";
          form.append("file", new Blob(chunks, { type: mimeType }), `request.${ext}`);
          const result = await transcribe({ data: form });
          if (mounted.current) onText(result.text);
        } catch (e) {
          if (mounted.current)
            toast.error(e instanceof Error ? e.message : "Could not transcribe recording.");
        } finally {
          if (mounted.current) {
            setState("idle");
            onBusy(false);
          }
        }
      };
      media.start();
      setState("recording");
      setSeconds(0);
      let elapsed = 0;
      timer.current = setInterval(() => {
        elapsed += 1;
        setSeconds(elapsed);
        if (elapsed >= VOICE_SECONDS && media.state === "recording") media.stop();
      }, 1000);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      onBusy(false);
      toast.error(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone access was denied. You can still type a request."
          : e instanceof Error
            ? e.message
            : "Could not start recording.",
      );
    }
  }
  return (
    <div className="flex shrink-0 items-center gap-1">
      {state === "recording" && (
        <span role="status" className="text-xs tabular-nums text-destructive">
          {seconds}s
        </span>
      )}
      <Button
        type="button"
        size="icon"
        variant={state === "recording" ? "destructive" : "ghost"}
        aria-label={
          state === "recording"
            ? "Stop recording"
            : state === "transcribing"
              ? "Transcribing recording"
              : "Record voice request"
        }
        title={state === "recording" ? "Stop recording" : "Record voice request"}
        disabled={state === "transcribing" || (disabled && state !== "recording")}
        onClick={() => (state === "recording" ? recorder.current?.stop() : void start())}
      >
        {state === "recording" ? (
          <Square />
        ) : state === "transcribing" ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <Mic />
        )}
      </Button>
    </div>
  );
}
