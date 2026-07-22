import * as Speech from 'expo-speech';

/**
 * Speech facade (M10, phase 11): native uses expo-speech, web resolves
 * speech.web.ts (SpeechSynthesis API) instead.
 */
export interface SpeakOptions {
  language?: string;
  rate?: number;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: () => void;
}

export function speak(text: string, options: SpeakOptions): void {
  Speech.speak(text, options);
}

export function stop(): void {
  void Speech.stop();
}
