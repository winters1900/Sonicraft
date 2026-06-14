export type VoiceControl =
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'helpOpen' }
  | { type: 'helpClose' };

const STOP_RE = /^(停止|停下|结束|暂停|关闭|关掉|别|不要)?(聆听|监听|识别|录音|听写)$|^(别听了|停一下|够了|结束聆听)$/;
const START_RE = /^(开始|继续|恢复|启动|打开|开启)(聆听|监听|识别|录音|听写)$/;
const HELP_OPEN_RE = /^(打开|显示|查看|看看)(帮助|指令帮助|命令帮助)$/;
const HELP_CLOSE_RE = /^(关闭|退出|隐藏|收起)(帮助|指令帮助|命令帮助)$/;

export function matchVoiceControl(text: string): VoiceControl | null {
  const t = text.trim().replace(/[。?!！，,\s]/g, '');
  if (STOP_RE.test(t)) return { type: 'stop' };
  if (START_RE.test(t)) return { type: 'start' };
  if (HELP_OPEN_RE.test(t)) return { type: 'helpOpen' };
  if (HELP_CLOSE_RE.test(t)) return { type: 'helpClose' };
  return null;
}
