import { useCallback, useMemo, useRef, useState } from 'react';
import type { ImagineCommand } from '@shared/commands';
import { CanvasEngine } from '../engine/CanvasEngine';
import { CommandExecutor } from '../executor/CommandExecutor';
import { autoPlace, positionToXY } from '../executor/placement';
import { imagineImage } from '../executor/imagineClient';
import { SHAPE_DEFAULTS } from '../engine/shapes';
import { routeCommand, type ParseSource } from '../parser/CommandRouter';

export interface LogEntry {
  id: number;
  text: string;
  via: 'text' | 'voice';
  source: ParseSource;
  ms: number;
  results: { ok: boolean; message: string }[];
}

/**
 * 绘图控制器：文字与语音输入的统一执行入口。
 * run(text) = 混合解析(routeCommand) → 执行器落地（含 AI 文生图异步分支）→ 追加日志，返回反馈文案（供 TTS）。
 */
export function useDrawController(engine: CanvasEngine | null, onFeedback?: (message: string) => void) {
  const executor = useMemo(() => (engine ? new CommandExecutor(engine) : null), [engine]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const feedbackRef = useRef(onFeedback);
  feedbackRef.current = onFeedback;

  // AI 文生图：异步生成。先放占位图元（显示“生成中…”），出图后回填 src。
  const runImagine = useCallback(
    async (cmd: ImagineCommand): Promise<{ ok: boolean; message: string }> => {
      if (!engine) return { ok: false, message: '' };
      const props = cmd.props ?? {};
      const scale = props.sizeScale ?? 1;
      const W = engine.width;
      const H = engine.height;
      const center = props.position
        ? positionToXY(props.position, W, H)
        : autoPlace(engine.getState().shapes, W, H);
      const placeholder = engine.add('image', {
        x: center.x,
        y: center.y,
        w: SHAPE_DEFAULTS.imageW * scale,
        h: SHAPE_DEFAULTS.imageH * scale,
        src: '',
      });
      feedbackRef.current?.(`正在生成「${cmd.prompt}」`); // 长任务即时反馈
      try {
        const src = await imagineImage(cmd.prompt);
        engine.update({ src }, [placeholder.id]);
        return { ok: true, message: `已生成「${cmd.prompt}」` };
      } catch (err) {
        engine.remove([placeholder.id]);
        const detail = err instanceof Error ? err.message : '请重试';
        return { ok: false, message: `「${cmd.prompt}」生成失败：${detail}` };
      }
    },
    [engine],
  );

  const run = useCallback(
    async (text: string, via: 'text' | 'voice' = 'text'): Promise<string> => {
      const t = text.trim();
      if (!t || !executor) return '';
      setBusy(true);
      try {
        const { commands, source, ms } = await routeCommand(t);
        const hasImagine = commands.some((c) => c.op === 'imagine');
        let results: { ok: boolean; message: string }[];
        if (!hasImagine) {
          // 纯同步命令：保留多步事务（失败回滚）语义
          results = executor.executeAll(commands).map((r) => ({ ok: r.ok, message: r.message }));
        } else {
          results = [];
          for (const cmd of commands) {
            if (cmd.op === 'imagine') results.push(await runImagine(cmd));
            else {
              const r = executor.execute(cmd);
              results.push({ ok: r.ok, message: r.message });
            }
          }
        }
        setLog((prev) => [{ id: seq.current++, text: t, via, source, ms, results }, ...prev].slice(0, 20));
        const message = results.map((r) => r.message).join('；');
        feedbackRef.current?.(message);
        return message;
      } finally {
        setBusy(false);
      }
    },
    [executor, runImagine],
  );

  return { run, log, busy };
}
