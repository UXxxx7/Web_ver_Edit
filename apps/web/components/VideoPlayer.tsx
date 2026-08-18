"use client";

// Native <video controls> crams play/current-time/scrub-bar/duration/
// fullscreen into one thin control strip. At the ~280px width these
// preview clips render at in a chat bubble, the actual draggable part of
// that scrub bar ends up only a few px wide — taps meant to seek land on
// play/pause instead ("press on it, can only pause but not pull the time
// slot"). This swaps that for a full-width <input type="range"> used only
// for scrubbing, so the whole bar's width is the seek target instead of a
// handle squeezed among four other controls.
import { useEffect, useRef, useState } from "react";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
      <path d="M7 5.5c0-1.1 1.2-1.8 2.2-1.2l10 6.5c.9.6.9 1.9 0 2.5l-10 6.5c-1 .6-2.2-.1-2.2-1.2v-13Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
      <rect x="6" y="4.5" width="4.5" height="15" rx="1" />
      <rect x="13.5" y="4.5" width="4.5" height="15" rx="1" />
    </svg>
  );
}

export function VideoPlayer({ src, className = "" }: { src: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [seeking, setSeeking] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Skip currentTime updates from playback while the user's actively
    // dragging the range input — otherwise the two fight over the value
    // and the thumb jumps back mid-drag.
    const onTime = () => {
      if (!seeking) setCurrentTime(v.currentTime);
    };
    const onEnd = () => setPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnd);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnd);
    };
  }, [seeking]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function seekTo(t: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t;
    setCurrentTime(t);
  }

  return (
    <div className={`overflow-hidden rounded-lg bg-black ${className}`}>
      <video
        ref={videoRef}
        src={src}
        playsInline
        onClick={togglePlay}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        className="block w-full cursor-pointer"
      />
      <div className="flex items-center gap-2 bg-black px-2.5 py-2">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-7 w-7 shrink-0 items-center justify-center text-white"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.05}
          value={currentTime}
          onChange={(e) => seekTo(Number(e.target.value))}
          onPointerDown={() => setSeeking(true)}
          onPointerUp={() => setSeeking(false)}
          aria-label="Seek"
          className="video-scrub h-5 flex-1"
        />
        <span className="w-9 shrink-0 text-right font-mono text-[10.5px] text-white/80">{formatTime(currentTime)}</span>
      </div>
    </div>
  );
}
