/**
 * Speech facade, web variant (M10, phase 11): SpeechSynthesis API.
 * Metro resolves this file instead of speech.ts on web.
 */
export interface SpeakOptions {
  language?: string;
  rate?: number;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: () => void;
}

export function speak(text: string, options: SpeakOptions): void {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = options.language ?? 'de-DE';
  utterance.rate = options.rate ?? 1;
  utterance.onend = () => options.onDone?.();
  utterance.onerror = () => options.onError?.();
  window.speechSynthesis.speak(utterance);
}

export function stop(): void {
  window.speechSynthesis.cancel();
}
