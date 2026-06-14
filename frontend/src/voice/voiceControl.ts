export type VoiceControl =
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'helpOpen' }
  | { type: 'helpClose' }
  | { type: 'toggleTts'; enabled: boolean };

const STOP_RE = /^(停止|结束|暂停|别|不要)?(聆听|监听|识别|录音|听写)$|^(别听了|停一下|够了|结束聆听)$/;
const START_RE = /^(开始|继续|恢复|启动)(聆听|监听|识别|录音|听写)$/;
const HELP_OPEN_RE = /^(打开|显示|查看|看看)(帮助|指令帮助|命令帮助)$/;
const HELP_CLOSE_RE = /^(关闭|退出|隐藏|收起)(帮助|指令帮助|命令帮助)$/;
const TTS_OFF_RE = /^(关闭|停止|静音|不要)(语音)?反馈$/;
const TTS_ON_RE = /^(开启|打开|恢复|启用)(语音)?反馈$/;

export function matchVoiceControl(text: string): VoiceControl | null {
  const t = text.trim().replace(/[。?!！，,\s]/g, '');
  if (STOP_RE.test(t)) return { type: 'stop' };
  if (START_RE.test(t)) return { type: 'start' };
  if (HELP_OPEN_RE.test(t)) return { type: 'helpOpen' };
  if (HELP_CLOSE_RE.test(t)) return { type: 'helpClose' };
  if (TTS_OFF_RE.test(t)) return { type: 'toggleTts', enabled: false };
  if (TTS_ON_RE.test(t)) return { type: 'toggleTts', enabled: true };
  return null;
}
