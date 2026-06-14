// 语音合成（TTS）底层封装。两种引擎：
// - qiniu: 经后端 /api/tts 取音频播放（官方路径）
// - browser: 浏览器 SpeechSynthesis，零延迟、无 key，作默认/兜底
// 任一失败都不影响绘图主流程。

import { beginTts, endTts } from './ttsGate';

export type TtsEngine = 'qiniu' | 'browser';

let currentAudio: HTMLAudioElement | null = null;

export function cancelSpeak(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  endTts(0); // 主动取消时立即解除静音窗口
}

export async function speak(text: string, engine: TtsEngine): Promise<void> {
  if (!text) return;
  cancelSpeak();
  if (engine === 'qiniu') {
    try {
      await speakQiniu(text);
      return;
    } catch {
      // 七牛失败时回退浏览器合成
    }
  }
  speakBrowser(text);
}

async function speakQiniu(text: string): Promise<void> {
  const resp = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) throw new Error(`tts ${resp.status}`);
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;
  beginTts(); // 播报期间静音麦克风，防回声自激
  const release = () => {
    URL.revokeObjectURL(url);
    endTts();
  };
  audio.onended = release;
  audio.onerror = release;
  try {
    await audio.play();
  } catch (e) {
    release();
    throw e;
  }
}

function speakBrowser(text: string): void {
  if (typeof speechSynthesis === 'undefined') return;
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
