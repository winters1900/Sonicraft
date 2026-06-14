export interface VadOptions {
  speakRms: number;
  silenceHoldMs: number;
  minSpeechMs: number;
  calibrationMs: number;
}

export const DEFAULT_VAD_OPTIONS: VadOptions = {
  speakRms: 0.04,
  silenceHoldMs: 900,
  minSpeechMs: 350,
  calibrationMs: 1000,
};

export function makeVadOptions(input: Partial<VadOptions> = {}): VadOptions {
  return {
    speakRms: positive(input.speakRms) ?? DEFAULT_VAD_OPTIONS.speakRms,
    silenceHoldMs: positive(input.silenceHoldMs) ?? DEFAULT_VAD_OPTIONS.silenceHoldMs,
    minSpeechMs: positive(input.minSpeechMs) ?? DEFAULT_VAD_OPTIONS.minSpeechMs,
    calibrationMs: positive(input.calibrationMs) ?? DEFAULT_VAD_OPTIONS.calibrationMs,
  };
}

export function calibrateVad(samples: number[], base: VadOptions): VadOptions {
  if (!samples.length) return base;
  const avg = samples.reduce((sum, item) => sum + item, 0) / samples.length;
  const speakRms = Math.max(base.speakRms, Math.min(0.18, avg * 2.2));
  return { ...base, speakRms };
}

function positive(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value) || value <= 0) return undefined;
  return value;
}
