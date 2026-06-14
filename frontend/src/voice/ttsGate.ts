// TTS 闸门 —— 持续聆听 + 语音反馈下的回声抑制。
// TTS 播报期间（及结束后一小段尾音冷却）置为 active，语音层据此丢弃自身播报被
// 麦克风录回的“回声”，避免系统把自己说的话当成新指令而自激循环。

let active = false;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

/** TTS 开始播报：进入静音窗口。 */
export function beginTts(): void {
  active = true;
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
}

/** TTS 结束：再保留 tailMs 冷却（覆盖扬声器余音/缓冲），之后解除。 */
export function endTts(tailMs = 500): void {
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    active = false;
    releaseTimer = null;
  }, tailMs);
}

/** 当前是否处于 TTS 静音窗口。 */
export function isTtsActive(): boolean {
  return active;
}
