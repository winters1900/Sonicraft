import { useCallback, useRef, useState } from 'react';
import { cancelSpeak, speak, type TtsEngine } from './speak';

/**
 * 语音反馈开关管理。enabled 控制是否播报；engine 默认随七牛密钥可用性自动选择。
 * 暴露 speakFeedback(text)，由绘图控制器在每次指令执行后调用。
 */
export function useSpeech(qiniuConfigured: boolean) {
  const [enabled, setEnabled] = useState(true);
  const engine: TtsEngine = qiniuConfigured ? 'qiniu' : 'browser';
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const speakFeedback = useCallback(
    (text: string) => {
      if (!enabledRef.current || !text) return;
      void speak(text, engine);
    },
    [engine],
  );

  const toggle = useCallback(() => {
    setEnabled((v) => {
      if (v) cancelSpeak();
      return !v;
    });
  }, []);

  return { enabled, toggle, engine, speakFeedback };
}
