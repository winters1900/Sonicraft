// 浏览器原生 Web Speech 为唯一 ASR 引擎：零下载、中文可用、不依赖外网/代理。
// （在 GFW + 仅后端代理的环境下，浏览器内 Whisper 无法下载模型，已移除。）
export type EngineKind = 'webspeech';

export interface VoiceHandlers {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (msg: string) => void;
  onStateChange?: (listening: boolean) => void;
}

export interface VoiceEngine {
  readonly kind: EngineKind;
  isAvailable(): boolean;
  start(handlers: VoiceHandlers): Promise<void>;
  stop(): void;
}
