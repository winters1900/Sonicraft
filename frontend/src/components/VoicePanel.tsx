import { useVoice } from '../voice/useVoice';
import type { VoiceControl } from '../voice/voiceControl';

interface Props {
  run: (text: string, via?: 'text' | 'voice') => Promise<string>;
  onVoiceControl: (control: VoiceControl) => void;
}

export function VoicePanel({ run, onVoiceControl }: Props) {
  const voice = useVoice({
    onControl: onVoiceControl,
    onFinal: (t) => void run(t, 'voice'),
  });

  const showTranscript = Boolean(voice.error || voice.partial || voice.listening);

  return (
    <div className="voice">
      <p className="studio-label">语音</p>

      <div className={`voice__mic-wrap ${voice.listening ? 'is-active' : ''}`}>
        <button
          className={`voice__mic ${voice.listening ? 'is-listening' : ''}`}
          onClick={voice.toggle}
          disabled={!voice.available}
          title={voice.available ? '开始/暂停持续聆听' : '当前环境不可用'}
        >
          <span className="voice__dot" />
          {voice.listening ? '聆听中' : '开始聆听'}
        </button>
      </div>

      <div className="voice__meta">
        <span className={`voice__pill ${voice.listening ? 'is-live' : ''}`}>
          {voice.listening ? 'LIVE' : 'IDLE'}
        </span>
      </div>

      {showTranscript && (
        <div className="voice__transcript">
          {voice.error ? (
            <span className="voice__error">{voice.error}</span>
          ) : voice.partial ? (
            <span className="voice__partial">{voice.partial}</span>
          ) : (
            <span className="voice__idle">可说「停止聆听」暂停</span>
          )}
        </div>
      )}
    </div>
  );
}
