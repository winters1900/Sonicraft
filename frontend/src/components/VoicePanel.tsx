import { useVoice } from '../voice/useVoice';
import type { VoiceControl } from '../voice/voiceControl';

interface Props {
  run: (text: string, via?: 'text' | 'voice') => Promise<string>;
  ttsEnabled: boolean;
  onToggleTts: () => void;
  onVoiceControl: (control: VoiceControl) => void;
}

export function VoicePanel({ run, ttsEnabled, onToggleTts, onVoiceControl }: Props) {
  const voice = useVoice({
    onControl: onVoiceControl,
    onFinal: (t) => void run(t, 'voice'),
  });

  return (
    <div className="voice">
      <button
        className={`voice__mic ${voice.listening ? 'is-listening' : ''}`}
        onClick={voice.toggle}
        disabled={!voice.available}
        title={voice.available ? '开始/暂停持续聆听' : '当前环境不可用'}
      >
        <span className="voice__dot" />
        {voice.listening ? '聆听中...开口即画' : '开始聆听'}
      </button>

      <div className="voice__engines">
        <button
          className={`voice__tts ${ttsEnabled ? 'is-active' : ''}`}
          onClick={onToggleTts}
          title="语音反馈开关"
        >
          {ttsEnabled ? '反馈开' : '反馈关'}
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
              ? '持续聆听中，可说“停止聆听”暂停'
              : '首次需点击授权麦克风，之后可纯语音控制'}
          </span>
        )}
      </div>
    </div>
  );
}
