import { beginTts, endTts } from './ttsGate';

export function cancelSpeak(): void {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  endTts(0);
}

export function speak(text: string): void {
  if (!text || typeof speechSynthesis === 'undefined') return;
  cancelSpeak();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-CN';
  utter.rate = 1.05;
  beginTts();
  utter.onend = () => endTts();
  utter.onerror = () => endTts();
  speechSynthesis.speak(utter);
}

export function browserTtsAvailable(): boolean {
  return typeof speechSynthesis !== 'undefined';
}
