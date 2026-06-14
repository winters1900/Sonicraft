import { useEffect, useState } from 'react';
import { useCanvasEngine } from './engine/useCanvasEngine';
import { useDrawController } from './controller/useDrawController';
import { useSpeech } from './voice/useSpeech';
import { DebugToolbar } from './components/DebugToolbar';
import { CommandConsole } from './components/CommandConsole';
import { VoicePanel } from './components/VoicePanel';
import { HelpOverlay } from './components/HelpOverlay';
import type { VoiceControl } from './voice/voiceControl';

interface HealthState {
  ok: boolean;
  hfConfigured: boolean;
}

export default function App() {
  const { canvasRef, engine, state } = useCanvasEngine(960, 600);
  const [health, setHealth] = useState<HealthState | null>(null);
  const speech = useSpeech();
  const { run, log } = useDrawController(engine.current, speech.speakFeedback);
  const [showHelp, setShowHelp] = useState(false);

  const handleVoiceControl = (control: VoiceControl) => {
    if (control.type === 'helpOpen') setShowHelp(true);
    if (control.type === 'helpClose') setShowHelp(false);
    if (control.type === 'toggleTts') speech.setFeedbackEnabled(control.enabled);
  };

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setHealth({ ok: d?.ok === true, hfConfigured: d?.hfConfigured === true }))
      .catch(() => setHealth({ ok: false, hfConfigured: false }));
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title font-firs">Sonicraft</h1>
        <span className="app__status">
          后端：{health === null ? '检测中...' : health.ok ? '已连接' : '未连接'}
          {health?.ok && (health.hfConfigured ? ' · HF 文生图可用' : ' · 未配置 HF_TOKEN')}
        </span>
        <div className="app__header-right">
          <span className="app__status">图形 {state.shapes.length} · 选中 {state.selectedIds.length}</span>
          <button className="app__help-btn" onClick={() => setShowHelp(true)}>指令帮助</button>
        </div>
      </header>

      {health?.ok && !health.hfConfigured && (
        <div className="app__banner" role="alert">
          未配置 HF_TOKEN，几何绘图可用；“画熊猫/芒果”等任意物体文生图会失败。
        </div>
      )}

      {import.meta.env.DEV && <DebugToolbar engine={engine.current} />}

      <div className="app__body">
        <div className="canvas-wrap">
          <canvas ref={canvasRef} width={960} height={600} />
        </div>
        <aside className="app__side">
          <VoicePanel
            run={run}
            ttsEnabled={speech.enabled}
            onToggleTts={speech.toggle}
            onVoiceControl={handleVoiceControl}
          />
          <CommandConsole log={log} />
        </aside>
      </div>

      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}
