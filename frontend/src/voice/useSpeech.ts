import { useCallback, useRef, useState } from 'react';
import { cancelSpeak, speak } from './speak';

export function useSpeech() {
  const [enabled, setEnabled] = useState(true);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const speakFeedback = useCallback((text: string) => {
    if (!enabledRef.current || !text) return;
    speak(text);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((v) => {
      if (v) cancelSpeak();
      return !v;
    });
  }, []);

  const setFeedbackEnabled = useCallback((next: boolean) => {
    setEnabled((current) => {
      if (current && !next) cancelSpeak();
      return next;
    });
  }, []);

  return { enabled, toggle, setFeedbackEnabled, engine: 'browser' as const, speakFeedback };
}
