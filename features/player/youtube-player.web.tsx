import React, { useEffect, useRef, useState } from 'react';

/**
 * Web YouTube player: IFrame Player API (only allowed playback form, PRD §7).
 * Same event API as the native variant (youtube-player.tsx).
 */

export type PlayerState = 'playing' | 'paused' | 'ended' | 'buffering';

export interface YouTubePlayerProps {
  videoId: string;
  startSeconds?: number;
  /** Seek command — change the value to jump (chapter taps, M5). */
  seekSeconds?: number;
  onReady?: () => void;
  onProgress?: (positionSec: number, durationSec: number) => void;
  onStateChange?: (state: PlayerState) => void;
}

const STATE_MAP: Record<number, PlayerState> = {
  0: 'ended',
  1: 'playing',
  2: 'paused',
  3: 'buffering',
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        options: {
          videoId: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: () => void;
            onStateChange?: (event: { data: number }) => void;
          };
        },
      ) => {
        getCurrentTime: () => number;
        getDuration: () => number;
        seekTo: (seconds: number, allowSeekAhead: boolean) => void;
        destroy: () => void;
      };
      ready?: (callback: () => void) => void;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadIframeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  apiPromise ??= new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(script);
  });
  return apiPromise;
}

let nextPlayerId = 0;

export function YouTubePlayer({
  videoId,
  startSeconds = 0,
  seekSeconds,
  onReady,
  onProgress,
  onStateChange,
}: YouTubePlayerProps) {
  const [elementId] = useState(() => `yt-player-${++nextPlayerId}`);
  const callbacksRef = useRef({ onReady, onProgress, onStateChange });
  const playerRef = useRef<{ seekTo: (s: number, a: boolean) => void } | null>(null);

  useEffect(() => {
    callbacksRef.current = { onReady, onProgress, onStateChange };
  });

  useEffect(() => {
    if (seekSeconds !== undefined) playerRef.current?.seekTo(seekSeconds, true);
  }, [seekSeconds]);

  useEffect(() => {
    let destroyed = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    let player: {
      getCurrentTime: () => number;
      getDuration: () => number;
      seekTo: (seconds: number, allowSeekAhead: boolean) => void;
      destroy: () => void;
    } | null = null;

    void loadIframeApi().then(() => {
      if (destroyed || !window.YT) return;
      player = new window.YT.Player(elementId, {
        videoId,
        playerVars: { playsinline: 1, rel: 0, start: Math.floor(startSeconds) },
        events: {
          onReady: () => {
            playerRef.current = player;
            callbacksRef.current.onReady?.();
            interval = setInterval(() => {
              callbacksRef.current.onProgress?.(player!.getCurrentTime(), player!.getDuration());
            }, 1000);
          },
          onStateChange: (event) => {
            const mapped = STATE_MAP[event.data];
            if (mapped) callbacksRef.current.onStateChange?.(mapped);
          },
        },
      });
    });

    return () => {
      destroyed = true;
      playerRef.current = null;
      if (interval) clearInterval(interval);
      player?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return (
    <div id={elementId} style={{ aspectRatio: '16 / 9', width: '100%', background: '#000' }} />
  );
}
