/*
INTEGRAÇÃO (4.1) — Player de VÍDEO em React (espelho do componente vanilla
Front-End/files/js/components/video-player.js).

Recebe uma URL qualquer: YouTube -> embed via IFrame API com polling de
progresso; qualquer outra URL (upload/S3/local) -> <video> HTML5.
Reporta onProgress({perc, seconds, completed}) em checkpoints de 10%.
*/
import { useEffect, useRef, useState } from "react";
import { useT } from "../../i18n";

const COMPLETED_PERC = 90;

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<any> | null = null;
const loadYouTubeAPI = () => {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return ytApiPromise;
};

export const youtubeIdFromUrl = (url: string | null) => {
  const match = (url ?? "").match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/);
  return match ? match[1] : null;
};

export interface MediaProgress {
  perc: number;
  seconds: number;
  completed: boolean;
}

interface VideoPlayerProps {
  url: string | null;
  mediaType: string | null;
  title: string;
  initialPerc: number;
  onProgress: (progress: MediaProgress) => void;
}

export const VideoPlayer = ({ url, mediaType, title, initialPerc, onProgress }: VideoPlayerProps) => {
  const slotRef = useRef<HTMLDivElement>(null);
  const [perc, setPerc] = useState(initialPerc);
  const t = useT();
  // Checkpoints de 10% — os já alcançados (estado do backend) começam feitos
  const checkpointsRef = useRef<Record<number, boolean>>(
    Object.fromEntries(Array.from({ length: 10 }, (_, i) => [(i + 1) * 10, (i + 1) * 10 <= initialPerc]))
  );

  const ytId = mediaType === "youtube" || /youtu/.test(url ?? "") ? youtubeIdFromUrl(url) : null;

  useEffect(() => {
    const handleTime = (current: number, duration: number) => {
      if (!duration) return;
      const reached = Math.min(100, Math.floor((100 * current) / duration));
      const checkpoints = checkpointsRef.current;
      Object.keys(checkpoints).forEach((key) => {
        const point = Number(key);
        if (reached >= point && !checkpoints[point]) {
          checkpoints[point] = true;
          setPerc(point);
          onProgress({ perc: point, seconds: Math.round(current), completed: point >= COMPLETED_PERC });
        }
      });
    };

    let interval: number | undefined;
    let player: any;
    const slot = slotRef.current;
    if (!slot) return;

    if (ytId) {
      const target = document.createElement("div");
      slot.appendChild(target);
      loadYouTubeAPI().then((YT) => {
        player = new YT.Player(target, {
          videoId: ytId,
          width: "100%",
          events: {
            onReady: () => {
              interval = window.setInterval(() => {
                const duration = player.getDuration?.() ?? 0;
                const current = player.getCurrentTime?.() ?? 0;
                if (duration > 0) handleTime(current, duration);
              }, 1000);
            }
          }
        });
      });
    } else if (url) {
      const video = document.createElement("video");
      video.controls = true;
      video.src = url;
      video.className = "w-full rounded-[8px]";
      video.addEventListener("timeupdate", () => handleTime(video.currentTime, video.duration));
      video.addEventListener("ended", () => handleTime(video.duration, video.duration));
      slot.appendChild(video);
    }

    return () => {
      if (interval) window.clearInterval(interval);
      player?.destroy?.();
      if (slot) slot.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ytId]);

  return (
    <div className="rounded-[8px] border border-line bg-white p-5">
      <h3 className="font-bold text-ink">{title}</h3>
      <div ref={slotRef} className="mt-3 aspect-video overflow-hidden rounded-[8px] bg-slate-950 [&>iframe]:h-full [&>iframe]:w-full" />
      <div className="mt-3 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${perc}%` }} />
      </div>
      <div className="mt-1 text-sm text-muted">{perc}% {t("assistido", "watched")}</div>
    </div>
  );
};
