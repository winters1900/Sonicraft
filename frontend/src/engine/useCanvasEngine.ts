import { useEffect, useRef, useState } from 'react';
import { CanvasEngine, type EngineState } from './CanvasEngine';

const CANVAS_PAD = 0;

/**
 * 把 CanvasEngine 接入 React：画板随容器自动撑满，引擎与状态供 UI 使用。
 */
export function useCanvasEngine() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const [state, setState] = useState<EngineState>({ shapes: [], selectedIds: [] });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const engine = new CanvasEngine(canvas);
    engineRef.current = engine;
    const unsub = engine.subscribe(setState);
    setState(engine.getState());

    const fit = () => {
      const { width, height } = wrap.getBoundingClientRect();
      const w = Math.floor(width - CANVAS_PAD * 2);
      const h = Math.floor(height - CANVAS_PAD * 2);
      if (w > 80 && h > 80) engine.resize(w, h);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);

    return () => {
      ro.disconnect();
      unsub();
      engineRef.current = null;
    };
  }, []);

  return { wrapRef, canvasRef, engine: engineRef, state };
}
