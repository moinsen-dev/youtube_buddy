import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

/**
 * Native YouTube player (iOS/Android): IFrame Player API inside a WebView
 * (only playback form allowed by YouTube ToS, PRD §7). Progress and state
 * events are bridged via postMessage into a unified event API shared with
 * the web variant (youtube-player.web.tsx).
 */

export type PlayerState = 'playing' | 'paused' | 'ended' | 'buffering';

export interface YouTubePlayerProps {
  videoId: string;
  /** Resume position. */
  startSeconds?: number;
  /** Fires once when the player API is ready (tracking starts here). */
  onReady?: () => void;
  /** ~1/s while the player runs: (positionSec, durationSec). */
  onProgress?: (positionSec: number, durationSec: number) => void;
  onStateChange?: (state: PlayerState) => void;
}

const STATE_MAP: Record<number, PlayerState> = {
  0: 'ended',
  1: 'playing',
  2: 'paused',
  3: 'buffering',
};

function buildHtml(videoId: string, startSeconds: number): string {
  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>html,body{margin:0;padding:0;background:#000;height:100%}#player{position:absolute;inset:0}</style>
  </head>
  <body>
    <div id="player"></div>
    <script>
      function post(obj){ window.ReactNativeWebView.postMessage(JSON.stringify(obj)); }
      var tag = document.createElement('script'); tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
      var player;
      function onYouTubeIframeAPIReady() {
        player = new YT.Player('player', {
          videoId: ${JSON.stringify(videoId)},
          playerVars: { playsinline: 1, rel: 0, start: ${Math.floor(startSeconds)} },
          events: {
            onReady: function () {
              post({ type: 'ready' });
              setInterval(function () {
                if (player && player.getCurrentTime) {
                  post({ type: 'progress', t: player.getCurrentTime(), d: player.getDuration() });
                }
              }, 1000);
            },
            onStateChange: function (event) { post({ type: 'state', data: event.data }); }
          }
        });
      }
    </script>
  </body>
</html>`;
}

export function YouTubePlayer({
  videoId,
  startSeconds = 0,
  onReady,
  onProgress,
  onStateChange,
}: YouTubePlayerProps) {
  const html = useMemo(() => buildHtml(videoId, startSeconds), [videoId, startSeconds]);
  const onReadyRef = useRef(onReady);
  const onProgressRef = useRef(onProgress);
  const onStateChangeRef = useRef(onStateChange);

  useEffect(() => {
    onReadyRef.current = onReady;
    onProgressRef.current = onProgress;
    onStateChangeRef.current = onStateChange;
  });

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as
        | { type: 'progress'; t: number; d: number }
        | { type: 'state'; data: number }
        | { type: 'ready' };
      if (message.type === 'ready') {
        onReadyRef.current?.();
      } else if (message.type === 'progress') {
        onProgressRef.current?.(message.t, message.d);
      } else if (message.type === 'state') {
        const mapped = STATE_MAP[message.data];
        if (mapped) onStateChangeRef.current?.(mapped);
      }
    } catch {
      // ignore malformed bridge messages
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        source={{ html, baseUrl: 'http://localhost:8081' }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['http://*', 'https://*']}
        mixedContentMode="compatibility"
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        scrollEnabled={false}
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    width: '100%',
  },
});
