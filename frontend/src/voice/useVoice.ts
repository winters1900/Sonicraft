import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EngineKind, VoiceEngine } from './types';
import { WebSpeechEngine } from './WebSpeechEngine';
import { QiniuAsrEngine } from './QiniuAsrEngine';
import { matchVoiceControl } from './voiceControl';
import { isTtsActive } from './ttsGate';

interface UseVoiceOptions {
  /** 后端是否已配置七牛密钥（决定默认引擎）。 */
  qiniuConfigured: boolean;
  /** 一段最终识别文本就绪时回调（交给绘图控制器执行）。 */
  onFinal: (text: string) => void;
}

/**
 * 语音输入管理：封装引擎选择(七牛/浏览器)、监听开关、实时字幕与错误。
 * 默认：后端配置了七牛密钥则用七牛 ASR，否则回退浏览器原生(保证无 key 也能演示)。
 */
export function useVoice({ qiniuConfigured, onFinal }: UseVoiceOptions) {
  const engines = useMemo(
    () => ({ qiniu: new QiniuAsrEngine(), webspeech: new WebSpeechEngine() }) as Record<EngineKind, VoiceEngine>,
    [],
  );

  const defaultKind: EngineKind =
    qiniuConfigured && engines.qiniu.isAvailable() ? 'qiniu' : 'webspeech';
  const [kind, setKind] = useState<EngineKind>(defaultKind);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState('');
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  // 用户是否手动选过引擎；没选过时跟随后端探测结果（health 通常晚于首屏返回）。
  const userPickedRef = useRef(false);

  // /api/health 返回后若七牛可用且用户未手动切换、当前未在聆听，则默认切到七牛。
  useEffect(() => {
    if (!userPickedRef.current && !listening && qiniuConfigured && engines.qiniu.isAvailable()) {
      setKind('qiniu');
    }
  }, [qiniuConfigured, engines, listening]);

  const engine = engines[kind];

  const start = useCallback(async () => {
    setError('');
    setPartial('');
    await engine.start({
      onPartial: (t) => {
        if (isTtsActive()) return; // TTS 播报期间忽略回声字幕
        setError('');
        setPartial(t);
      },
      onFinal: (text) => {
        // 回声抑制：丢弃 TTS 播报期间录回的自身语音，防自激循环
        if (isTtsActive()) {
          setPartial('');
          return;
        }
        setError('');
        setPartial('');
        // 先拦截麦克风控制口令（如“停止聆听”），避免被当作绘图指令
        if (matchVoiceControl(text) === 'stop') {
          engine.stop();
          return;
        }
        onFinalRef.current(text);
      },
      // 持续聆听下，单段识别出错只提示、不中断监听；下一段成功会自动清除。
      // 麦克风权限等致命错误时引擎不会发 onStateChange(true)，listening 自然保持 false。
      onError: (msg) => setError(msg),
      onStateChange: setListening,
    });
  }, [engine]);

  const stop = useCallback(() => engine.stop(), [engine]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else void start();
  }, [listening, start, stop]);

  const switchEngine = useCallback(
    (next: EngineKind) => {
      userPickedRef.current = true;
      if (listening) stop();
      setKind(next);
      setPartial('');
      setError('');
    },
    [listening, stop],
  );

  return {
    kind,
    listening,
    partial,
    error,
    available: engine.isAvailable(),
    toggle,
    switchEngine,
  };
}
