import { useEffect, useRef, useState } from 'react';

// PR-0：最小骨架——空白画布 + 后端健康检查指示灯。
// 后续 PR 会在此基础上挂载绘图引擎、语音控制与状态面板。
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setBackendOk(d?.ok === true))
      .catch(() => setBackendOk(false));
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <h1>🎙️ AI 语音绘图工具</h1>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>
          后端：
          {backendOk === null ? '检测中…' : backendOk ? '已连接 ✓' : '未连接 ✗'}
        </span>
      </header>
      <div className="app__body">
        <div className="canvas-wrap">
          <canvas ref={canvasRef} width={960} height={600} />
        </div>
      </div>
    </div>
  );
}
