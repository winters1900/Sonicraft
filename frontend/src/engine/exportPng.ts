import type { CanvasEngine } from './CanvasEngine';

/** 生成带时间戳的默认导出文件名。 */
export function buildVoiceDrawFilename(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `voice-draw-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.png`;
}

/** 将 data URL 触发为浏览器下载。 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** 将当前画布导出为 PNG 并下载；空画布时返回 false。 */
export function exportCanvasPng(engine: CanvasEngine, filename?: string): boolean {
  if (engine.getState().shapes.length === 0) return false;
  downloadDataUrl(engine.toDataURL(), filename ?? buildVoiceDrawFilename());
  return true;
}
