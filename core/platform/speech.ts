/**
 * Speech facade (M10, phase 11): native uses expo-speech, web resolves
 * speech.web.ts (SpeechSynthesis API) instead.
 *
 * Lazy import: expo-speech is not linked on tvOS (phase 12), so a static
 * import would crash the whole bundle there.
 */
export interface SpeakOptions {
  language?: string;
  rate?: number;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: () => void;
}

export function speak(text: string, options: SpeakOptions): void {
  void import('expo-speech').then((Speech) => Speech.speak(text, options));
}

export function stop(): void {
  void import('expo-speech').then((Speech) => Speech.stop());
}
