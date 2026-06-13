import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildVoiceDrawFilename, downloadDataUrl, exportCanvasPng } from './exportPng';
import type { CanvasEngine } from './CanvasEngine';

function stubDocument() {
  const click = vi.fn();
  const link = {
    href: '',
    download: '',
    rel: '',
    click,
    remove: vi.fn(),
  } as unknown as HTMLAnchorElement;
  vi.stubGlobal('document', {
    createElement: vi.fn(() => link),
    body: { appendChild: vi.fn(() => link) },
  });
  return { click, link };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildVoiceDrawFilename', () => {
  it('生成带时间戳的 png 文件名', () => {
    const name = buildVoiceDrawFilename(new Date('2026-06-13T14:05:09'));
    expect(name).toBe('voice-draw-20260613-140509.png');
  });
});

describe('downloadDataUrl', () => {
  it('创建临时链接触发下载', () => {
    const { click, link } = stubDocument();

    downloadDataUrl('data:image/png;base64,abc', 'test.png');

    expect(link.href).toBe('data:image/png;base64,abc');
    expect(link.download).toBe('test.png');
    expect(click).toHaveBeenCalledOnce();
    expect(link.remove).toHaveBeenCalledOnce();
  });
});

describe('exportCanvasPng', () => {
  it('空画布时不导出', () => {
    const engine = {
      getState: () => ({ shapes: [], selectedIds: [] }),
      toDataURL: vi.fn(),
    } as unknown as CanvasEngine;
    expect(exportCanvasPng(engine)).toBe(false);
    expect(engine.toDataURL).not.toHaveBeenCalled();
  });

  it('有图形时导出并返回 true', () => {
    const engine = {
      getState: () => ({ shapes: [{ id: 's1' }], selectedIds: [] }),
      toDataURL: vi.fn(() => 'data:image/png;base64,abc'),
    } as unknown as CanvasEngine;
    const { click, link } = stubDocument();

    expect(exportCanvasPng(engine, 'custom.png')).toBe(true);
    expect(engine.toDataURL).toHaveBeenCalledOnce();
    expect(link.download).toBe('custom.png');
    expect(click).toHaveBeenCalledOnce();
  });
});
