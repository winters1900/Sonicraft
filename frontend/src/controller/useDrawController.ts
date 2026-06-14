import { useCallback, useMemo, useRef, useState } from 'react';
import type { BackgroundCommand, ImagineCommand } from '@shared/commands';
import { CanvasEngine } from '../engine/CanvasEngine';
import { CommandExecutor } from '../executor/CommandExecutor';
import { autoPlace, positionToXY } from '../executor/placement';
import { imagineImage } from '../executor/imagineClient';
import { removeBackground } from '../executor/matting';
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
 * run(text) = 混合解析(routeCommand) → 执行器落地（含 AI 文生图异步分支）→ 追加日志，返回结果文案。
 */
export function useDrawController(engine: CanvasEngine | null) {
  const executor = useMemo(() => (engine ? new CommandExecutor(engine) : null), [engine]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

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
      try {
        let src = await imagineImage(cmd.prompt);
        // 前景物体用 RMBG 真抠图去背景，便于自然合成到画布背景上；
        // 模型加载/推理失败则静默回退用原图（仍可见，只是带原背景）。
        try {
          src = await removeBackground(src);
        } catch {
          /* 抠图不可用时回退，不阻断绘图 */
        }
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

  // AI 文生图作为画布背景：异步生成后铺满当前画布。
  const runBackground = useCallback(
    async (cmd: BackgroundCommand): Promise<{ ok: boolean; message: string }> => {
      if (!engine || cmd.mode !== 'image' || !cmd.prompt) return { ok: false, message: '' };
      try {
        const src = await imagineImage(cmd.prompt);
        engine.setBackgroundImage(src);
        return { ok: true, message: `已将背景换成「${cmd.prompt}」` };
      } catch (err) {
        const detail = err instanceof Error ? err.message : '请重试';
        return { ok: false, message: `背景「${cmd.prompt}」生成失败：${detail}` };
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
        // 需异步处理（网络文生图）的命令：imagine 与 background(image)。
        const isAsync = (c: typeof commands[number]) =>
          c.op === 'imagine' || (c.op === 'background' && c.mode === 'image');
        const hasAsync = commands.some(isAsync);
        let results: { ok: boolean; message: string }[];
        if (!hasAsync) {
          // 纯同步命令：保留多步事务（失败回滚）语义
          results = executor.executeAll(commands).map((r) => ({ ok: r.ok, message: r.message }));
        } else {
          results = [];
          for (const cmd of commands) {
            if (cmd.op === 'imagine') results.push(await runImagine(cmd));
            else if (cmd.op === 'background' && cmd.mode === 'image') results.push(await runBackground(cmd));
            else {
              const r = executor.execute(cmd);
              results.push({ ok: r.ok, message: r.message });
            }
          }
        }
        setLog((prev) => [{ id: seq.current++, text: t, via, source, ms, results }, ...prev].slice(0, 20));
        const message = results.map((r) => r.message).join('；');
        return message;
      } finally {
        setBusy(false);
      }
    },
    [executor, runImagine],
  );

  return { run, log, busy };
}
