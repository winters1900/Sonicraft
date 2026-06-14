import { describe, expect, it } from 'vitest';
import { calibrateVad, DEFAULT_VAD_OPTIONS, makeVadOptions } from './vad';

describe('VAD 配置与噪声校准', () => {
  it('允许覆盖静音判句与最短语音参数', () => {
    const options = makeVadOptions({ silenceHoldMs: 650, minSpeechMs: 250 });
    expect(options.silenceHoldMs).toBe(650);
    expect(options.minSpeechMs).toBe(250);
    expect(options.speakRms).toBe(DEFAULT_VAD_OPTIONS.speakRms);
  });

  it('忽略非法参数并保留安全默认值', () => {
    const options = makeVadOptions({ speakRms: -1, silenceHoldMs: Number.NaN });
    expect(options.speakRms).toBe(DEFAULT_VAD_OPTIONS.speakRms);
    expect(options.silenceHoldMs).toBe(DEFAULT_VAD_OPTIONS.silenceHoldMs);
  });

  it('嘈杂环境提高人声阈值，安静环境不低于默认阈值', () => {
    const noisy = calibrateVad([0.07, 0.08, 0.075], DEFAULT_VAD_OPTIONS);
    const quiet = calibrateVad([0.004, 0.006, 0.005], DEFAULT_VAD_OPTIONS);
    expect(noisy.speakRms).toBeGreaterThan(DEFAULT_VAD_OPTIONS.speakRms);
    expect(quiet.speakRms).toBe(DEFAULT_VAD_OPTIONS.speakRms);
  });
});
