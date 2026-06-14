import { useVoice } from '../voice/useVoice';
import type { EngineKind } from '../voice/types';

interface Props {
  run: (text: string, via?: 'text' | 'voice') => Promise<string>;
  qiniuConfigured: boolean;
  ttsEnabled: boolean;
  onToggleTts: () => void;
}

const ENGINE_LABEL: Record<EngineKind, string> = {
  qiniu: '七牛 ASR',
  webspeech: '浏览器',
};

// 语音输入面板：麦克风开关、实时字幕、识别引擎切换。语音是本工具的主交互方式。
export function VoicePanel({ run, qiniuConfigured, ttsEnabled, onToggleTts }: Props) {
  const voice = useVoice({ qiniuConfigured, onFinal: (t) => void run(t, 'voice') });

  return (
    <div className="voice">
      <button
        className={`voice__mic ${voice.listening ? 'is-listening' : ''}`}
        onClick={voice.toggle}
        disabled={!voice.available}
        title={voice.available ? '开始/暂停持续聆听' : '当前环境不可用'}
      >
        <span className="voice__dot" />
        {voice.listening ? '聆听中…（开口即画）' : '开始聆听'}
      </button>

      <div className="voice__engines">
        {(['qiniu', 'webspeech'] as EngineKind[]).map((k) => (
          <button
            key={k}
            className={voice.kind === k ? 'is-active' : ''}
            onClick={() => voice.switchEngine(k)}
          >
            {ENGINE_LABEL[k]}
          </button>
        ))}
        <button
          className={`voice__tts ${ttsEnabled ? 'is-active' : ''}`}
          onClick={onToggleTts}
          title="语音反馈开关"
        >
          {ttsEnabled ? '🔊 反馈' : '🔇 反馈'}
        </button>
      </div>

      <div className="voice__transcript">
        {voice.error ? (
          <span className="voice__error">{voice.error}</span>
        ) : voice.partial ? (
          <span className="voice__partial">{voice.partial}</span>
        ) : (
          <span className="voice__idle">
            {voice.listening
              ? '持续聆听中，开口即画，无需点击；说「停止聆听」可暂停'
              : '点击「开始聆听」，之后全程语音操作，无需鼠标键盘'}
          </span>
        )}
      </div>
    </div>
  );
}
