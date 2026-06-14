import type { EngineKind, VoiceEngine, VoiceHandlers } from './types';
import { isTtsActive } from './ttsGate';

// 七牛云 ASR 引擎（经后端 /api/asr 代理）——持续聆听 + 能量 VAD 自动断句。
// 纯语音工具的核心交互：start() 后一直监听麦克风，检测到说话→停顿即自动切出一段，
// 送后端识别并回调 onFinal，随后无缝继续听下一句；全程无需再点击。
// 七牛为录音-发送型（非流式），故用 Web Audio 实时能量检测做断句，每段一次 REST 识别。
export class QiniuAsrEngine implements VoiceEngine {
  readonly kind: EngineKind = 'qiniu';
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private handlers: VoiceHandlers | null = null;

  private active = false;        // 是否处于持续聆听
  private speaking = false;      // 当前是否正在录一段语音
  private keepSegment = true;    // 本段是否足够长、值得送识别
  private lastVoiceAt = 0;       // 最近一次检测到声音的时刻
  private speechStartedAt = 0;   // 本段开始时刻
  private rafId = 0;
  private mime = 'audio/webm';

  // VAD 阈值（经验值，可按需微调）
  private static readonly SPEAK_RMS = 0.04;     // 高于此视为有人声
  private static readonly SILENCE_HOLD = 900;   // 停顿超过此毫秒数判定一句结束
  private static readonly MIN_SPEECH = 350;     // 短于此毫秒数视为噪声丢弃

  isAvailable(): boolean {
    return (
      typeof MediaRecorder !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof (window.AudioContext ?? (window as any).webkitAudioContext) !== 'undefined'
    );
  }

  async start(handlers: VoiceHandlers): Promise<void> {
    this.handlers = handlers;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      handlers.onError?.('无法访问麦克风，请检查权限');
      return;
    }
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    this.audioCtx = new Ctx();
    await this.audioCtx.resume().catch(() => {});
    const source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 1024;
    source.connect(this.analyser);

    this.active = true;
    handlers.onStateChange?.(true);
    handlers.onPartial?.('（持续聆听中，开口即说，停顿后自动识别）');
    this.rafId = requestAnimationFrame(this.monitor);
  }

  /** 实时能量监测：决定何时开始/结束一段语音。 */
  private monitor = (): void => {
    if (!this.active || !this.analyser) return;
    const buf = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    const now = performance.now();

    // TTS 播报期间不开新段：既防回声被识别，也省去把回声上传 Kodo 的开销。
    if (rms > QiniuAsrEngine.SPEAK_RMS && !(isTtsActive() && !this.speaking)) {
      this.lastVoiceAt = now;
      if (!this.speaking) {
        this.speaking = true;
        this.speechStartedAt = now;
        this.beginSegment();
      }
    } else if (this.speaking && now - this.lastVoiceAt > QiniuAsrEngine.SILENCE_HOLD) {
      const dur = now - this.speechStartedAt;
      this.speaking = false;
      this.keepSegment = dur >= QiniuAsrEngine.MIN_SPEECH;
      this.endSegment(); // onstop → flush（按 keepSegment 决定是否送识别）
    }

    this.rafId = requestAnimationFrame(this.monitor);
  };

  private beginSegment(): void {
    if (!this.stream) return;
    this.chunks = [];
    this.keepSegment = true;
    this.recorder = new MediaRecorder(this.stream);
    this.mime = this.recorder.mimeType || 'audio/webm';
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.onstop = () => void this.flush();
    this.recorder.start();
  }

  private endSegment(): void {
    try {
      if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    } catch {
      /* ignore */
    }
  }

  stop(): void {
    this.active = false;
    this.speaking = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.endSegment(); // 收尾：仍会 flush 最后一段（若够长）
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
    this.analyser = null;
    this.handlers?.onStateChange?.(false);
  }

  /** 一段录音结束：转 base64 发往后端识别。 */
  private async flush(): Promise<void> {
    const h = this.handlers;
    const blob = new Blob(this.chunks, { type: this.mime });
    this.chunks = [];
    this.recorder = null;
    if (!h || !this.keepSegment || blob.size < 1200) return; // 太短/噪声直接丢弃

    const format = this.mime.includes('webm') ? 'webm' : this.mime.includes('ogg') ? 'ogg' : 'wav';
    try {
      h.onPartial?.('识别中…');
      const base64 = await blobToBase64(blob);
      const resp = await fetch('/api/asr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, format }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        h.onError?.(data?.error ?? `识别失败(${resp.status})`);
        return;
      }
      const { text } = (await resp.json()) as { text?: string };
      if (text && text.trim()) h.onFinal(text.trim());
      else h.onPartial?.(''); // 没识别到内容，静默继续聆听
    } catch {
      h.onError?.('语音识别请求失败');
    }
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result);
      // dataURL: "data:...;base64,XXXX" → 取逗号后的纯 base64
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
