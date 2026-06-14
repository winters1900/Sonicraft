import { useCallback, useMemo, useRef, useState } from 'react';
import type { EngineKind, VoiceEngine } from './types';
import { WebSpeechEngine } from './WebSpeechEngine';
import { matchVoiceControl, type VoiceControl } from './voiceControl';
import { isTtsActive } from './ttsGate';

interface UseVoiceOptions {
  onFinal: (text: string) => void;
  onControl?: (control: VoiceControl) => void;
}

/**
 * 语音输入管理：持续聆听、实时字幕、错误。
 * 引擎为浏览器原生 Web Speech（唯一）；先拦截“停止聆听/帮助/反馈”等元控制口令。
 */
export function useVoice({ onFinal, onControl }: UseVoiceOptions) {
  const engines = useMemo(
    () => ({ webspeech: new WebSpeechEngine() }) as Record<EngineKind, VoiceEngine>,
    [],
  );
  const [kind] = useState<EngineKind>('webspeech');
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState('');
  const onFinalRef = useRef(onFinal);
  const onControlRef = useRef(onControl);
  onFinalRef.current = onFinal;
  onControlRef.current = onControl;

  const engine = engines[kind];

  const start = useCallback(async () => {
    setError('');
    setPartial('');
    await engine.start({
      onPartial: (t) => {
        if (isTtsActive()) return; // 回声抑制：TTS 播报期间忽略字幕
        setError('');
        setPartial(t);
      },
      onFinal: (text) => {
        if (isTtsActive()) {
          setPartial('');
          return;
        }
        setError('');
        setPartial('');
        const control = matchVoiceControl(text);
        if (!control) {
          onFinalRef.current(text);
          return;
        }
        onControlRef.current?.(control);
        if (control.type === 'stop') engine.stop();
      },
      onError: setError,
      onStateChange: setListening,
    });
  }, [engine]);

  const stop = useCallback(() => engine.stop(), [engine]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else void start();
  }, [listening, start, stop]);

  return {
    listening,
    partial,
    error,
    available: engine.isAvailable(),
    toggle,
  };
}
